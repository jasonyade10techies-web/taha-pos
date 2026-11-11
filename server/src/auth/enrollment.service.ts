import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,UnauthorizedException,ServiceUnavailableException} from '@nestjs/common';
import {createHash,createPublicKey,randomUUID,verify,X509Certificate} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Database,type Actor} from '../database/database.service';
import {AuthService} from './auth.service';
import {createToken,digestToken} from './crypto';
import {uuid} from '../business/business.service';
@Injectable()
export class EnrollmentService{
 constructor(@Inject(Database) private readonly db:Database,@Inject(AuthService) private readonly auth:AuthService){}
 private channel(){
  try{
   const address=new URL(process.env.TAHA_LAN_TLS_ORIGIN??'');
   if(address.protocol!=='https:'||address.pathname!=='/'||address.username||address.password||address.search||address.hash)throw new Error();
   const cert=new X509Certificate(readFileSync(process.env.TAHA_LAN_TLS_CERT!));
   if(Date.parse(cert.validTo)<=Date.now()||Date.parse(cert.validFrom)>Date.now())throw new Error();
   return {address:address.origin,pin:createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('hex')};
  }catch{throw new ServiceUnavailableException('Secure phone enrollment is unavailable. Configure the shop HTTPS certificate, private key and reachable HTTPS address; cleartext pairing cannot sign in a new phone.');}
 }
 private proof(key:string,message:string,signature:string){
  try{if(typeof key!=='string'||key.length>1024||typeof signature!=='string'||signature.length>200)throw new Error();const pub=createPublicKey(key);if(pub.asymmetricKeyType!=='ec'||pub.asymmetricKeyDetails?.namedCurve!=='prime256v1'||!verify('sha256',Buffer.from(message),pub,Buffer.from(signature,'base64')))throw new Error();}
  catch{throw new UnauthorizedException('Device identity proof was rejected. Scan a fresh code.');}
 }
 async create(actor:Actor,b:{storeId:string,terminalId:string}){
  const channel=this.channel();uuid(b.storeId);
  const context=await this.db.context(actor);
  if(actor.companion||!['owner','manager'].includes(context.profile?.role)||context.store?.id!==b.storeId||!await this.db.permission(actor,'devices.pair',b.storeId))throw new ForbiddenException('An authorized owner or manager must connect the phone.');
  const terminal=(await this.db.query('select * from app_private.terminals where store_id=$1 and id=$2 and owner_profile_id=$3 and current_session_id=$4',[b.storeId,b.terminalId,actor.userId,actor.sessionId])).rows[0];
  if(!terminal)throw new ForbiddenException('Register this counter in the current desktop session first.');
  const challenge=createToken();
  const row=await this.db.transaction(async db=>{
   await db.query('update app_private.device_enrollments set expires_at=least(expires_at,now()) where requester_session_id=$1 and consumed_at is null',[actor.sessionId]);
   return (await db.query('insert into app_private.device_enrollments(challenge_hash,store_id,terminal_id,requester_id,requester_session_id) values($1,$2,$3,$4,$5) returning id,expires_at',[digestToken(challenge),b.storeId,b.terminalId,actor.userId,actor.sessionId])).rows[0];
  });
  const expiresAt=new Date(row.expires_at).toISOString();const params=new URLSearchParams({shop:channel.address,pin:channel.pin,id:row.id,challenge,store:b.storeId,terminal:b.terminalId,expires:expiresAt});
  return {id:row.id,challenge,expiresAt,...channel,storeId:b.storeId,terminalId:b.terminalId,terminalName:terminal.name,qrPayload:'taha-mobile://enroll?'+params};
 }
 private async valid(db:{query:Database['query']},id:string,challenge?:string){
  uuid(id);const r=(await db.query(`select e.*,s.revoked_at as parent_revoked,s.expires_at as parent_expires from app_private.device_enrollments e join app_private.sessions s on s.id=e.requester_session_id where e.id=$1 for update of e`,[id])).rows[0];
  if(!r||r.consumed_at||new Date(r.expires_at)<=new Date()||r.parent_revoked||new Date(r.parent_expires)<=new Date()||(challenge!==undefined&&digestToken(challenge)!==r.challenge_hash))throw new BadRequestException('This connection code expired or was already used. Generate a new QR.');return r;
 }
 async request(id:string,b:{challenge:string,storeId:string,terminalId:string,deviceId:string,deviceName:string,publicKey:string,signature:string}){
  uuid(b.deviceId);if(typeof b.challenge!=='string'||!/^[a-f0-9]{64}$/.test(b.challenge))throw new BadRequestException('Invalid challenge.');
  return this.db.transaction(async db=>{const e=await this.valid(db,id,b.challenge);if(e.store_id!==b.storeId||e.terminal_id!==b.terminalId)throw new BadRequestException('This code belongs to another shop or counter.');
   this.proof(b.publicKey,`taha-enroll-v1\n${id}\n${b.challenge}\n${b.storeId}\n${b.terminalId}\n${b.deviceId}`,b.signature);
   if(e.requested_at)throw new ConflictException('This QR already has a phone awaiting approval. Generate another QR if this is not your phone.');
   const pub=createPublicKey(b.publicKey).export({type:'spki',format:'der'});const fingerprint=createHash('sha256').update(pub).digest('hex');
   const name=typeof b.deviceName==='string'?b.deviceName.trim().slice(0,120):'Android phone';
   await db.query('update app_private.device_enrollments set device_id=$2,device_name=$3,public_key=$4,key_fingerprint=$5,requested_at=now() where id=$1',[id,b.deviceId,name||'Android phone',b.publicKey,fingerprint]);
   return {status:'awaiting-approval',fingerprint};
  });
 }
 async status(actor:Actor,id:string){uuid(id);const e=(await this.db.query('select id,device_name as "deviceName",key_fingerprint as fingerprint,requested_at as "requestedAt",approved_at as "approvedAt",consumed_at as "consumedAt",expires_at as "expiresAt" from app_private.device_enrollments where id=$1 and requester_id=$2 and requester_session_id=$3',[id,actor.userId,actor.sessionId])).rows[0];if(!e)throw new ForbiddenException();return e;}
 async approve(actor:Actor,id:string){return this.db.transaction(async db=>{const e=await this.valid(db,id);const context=await this.db.context(actor);
  if(actor.companion||e.requester_id!==actor.userId||e.requester_session_id!==actor.sessionId||context.store?.id!==e.store_id||!['owner','manager'].includes(context.profile?.role)||!await this.db.permission(actor,'devices.pair',e.store_id))throw new ForbiddenException('Approve on the desktop that generated this QR.');
  if(!e.requested_at)throw new BadRequestException('No phone is waiting.');
  await db.query('update app_private.device_enrollments set approved_at=now(),approved_by=$2 where id=$1',[id,actor.userId]);await db.query("select app_private.auth_audit($1,'auth.companion_approved',$2)",[actor.userId,actor.sessionId]);return {ok:true};
 });}
 async complete(id:string,b:{challenge:string,signature:string}){
  const refreshToken=createToken(),sessionId=randomUUID();
  const actor=await this.db.transaction(async db=>{const e=await this.valid(db,id,b.challenge);if(!e.approved_at||!e.public_key)throw new ForbiddenException('Awaiting owner approval on the PC.');
   this.proof(e.public_key,`taha-complete-v1\n${id}\n${b.challenge}`,b.signature);
   const existing=(await db.query('select * from app_private.staff_devices where id=$1 for update',[e.device_id])).rows[0];
   if(existing&&(existing.store_id!==e.store_id||existing.owner_profile_id!==e.requester_id))throw new ForbiddenException('This phone belongs to another shop. Revoke its previous enrollment first.');
   await db.query('update app_private.sessions set revoked_at=coalesce(revoked_at,now()) where id in(select session_id from app_private.companion_sessions where device_id=$1)',[e.device_id]);
   await db.query('insert into app_private.sessions(id,user_id,device_name,ip_hash) values($1,$2,$3,$4)',[sessionId,e.requester_id,e.device_name,digestToken('companion')]);
   await db.query('insert into app_private.refresh_tokens(token_hash,session_id) values($1,$2)',[digestToken(refreshToken),sessionId]);
   await db.query('insert into app_private.companion_sessions(session_id,enrollment_id,store_id,terminal_id,device_id,public_key,approving_session_id,approved_by) values($1,$2,$3,$4,$5,$6,$7,$8)',[sessionId,id,e.store_id,e.terminal_id,e.device_id,e.public_key,e.requester_session_id,e.approved_by]);
   await db.query("insert into app_private.staff_devices(id,store_id,owner_profile_id,current_session_id,name,platform) values($1,$2,$3,$4,$5,'Android') on conflict(id) do update set current_session_id=excluded.current_session_id,name=excluded.name,last_seen_at=now()",[e.device_id,e.store_id,e.requester_id,sessionId,e.device_name]);
   await db.query('update app_private.device_pairings set revoked_at=now() where device_id=$1 and revoked_at is null',[e.device_id]);
   await db.query('insert into app_private.device_pairings(store_id,terminal_id,requester_id,code_hash,device_session_id,device_profile_id,device_name,device_id,paired_at) values($1,$2,$3,$4,$5,$3,$6,$7,now())',[e.store_id,e.terminal_id,e.requester_id,digestToken(createToken()),sessionId,e.device_name,e.device_id]);
   await db.query('update app_private.device_enrollments set consumed_at=now() where id=$1',[id]);await db.query("select app_private.auth_audit($1,'auth.companion_enrolled',$2)",[e.requester_id,sessionId]);
   return {userId:e.requester_id as string,sessionId,companion:{storeId:e.store_id as string,terminalId:e.terminal_id as string,deviceId:e.device_id as string}};
  });
  return {...await this.auth.companionResult(actor),refreshToken,sessionId};
 }
 async refresh(b:{refreshToken:string,signature:string}){
  if(typeof b.refreshToken!=='string'||!/^[a-f0-9]{64}$/.test(b.refreshToken))throw new UnauthorizedException();
  const c=(await this.db.query('select c.public_key from app_private.refresh_tokens r join app_private.companion_sessions c on c.session_id=r.session_id where r.token_hash=$1',[digestToken(b.refreshToken)])).rows[0];
  if(!c)throw new UnauthorizedException();this.proof(c.public_key,'taha-refresh-v1\n'+b.refreshToken,b.signature);
  const r=await this.auth.refresh(b.refreshToken,true);return {...r.body,refreshToken:r.refreshToken};
 }
}
