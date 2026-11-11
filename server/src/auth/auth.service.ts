import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt,{type JwtPayload} from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { CONFIG,type Configuration } from '../config';
import { Database,type Actor } from '../database/database.service';
import {createToken,digestToken,hashPassword,validatePassword,verifyPassword} from './crypto';

@Injectable()
export class AuthService {
 constructor(@Inject(Database) private readonly db:Database,@Inject(CONFIG) private readonly config:Configuration){}
 private access(actor:Actor){return jwt.sign({sid:actor.sessionId},this.config.secret,{subject:actor.userId,algorithm:'HS256',expiresIn:900,issuer:'taha-pos',audience:'taha-pos-api'});}
 async authenticate(token:string,counterToken?:string):Promise<Actor>{
  let payload:JwtPayload;try{payload=jwt.verify(token,this.config.secret,{algorithms:['HS256'],issuer:'taha-pos',audience:'taha-pos-api'}) as JwtPayload;}catch{throw new UnauthorizedException('Your session expired. Sign in again.');}
  if(!payload.sub || typeof payload.sid!=='string')throw new UnauthorizedException();
  const s=(await this.db.query(`select s.id from app_private.sessions s join app_private.accounts a on a.user_id=s.user_id where s.id=$1 and s.user_id=$2 and s.revoked_at is null and s.expires_at>now() and a.enabled`,[payload.sid,payload.sub])).rows[0];
  if(!s)throw new UnauthorizedException('Your session has ended. Sign in again.');
  if(counterToken && !/^[a-f0-9]{64}$/.test(counterToken))throw new UnauthorizedException('Invalid counter session.');
  const actor:Actor={userId:payload.sub,sessionId:payload.sid,counterToken};
  const companion=(await this.db.query(`select c.*,p.revoked_at as parent_revoked,p.expires_at as parent_expires,t.current_session_id from app_private.companion_sessions c join app_private.sessions p on p.id=c.approving_session_id join app_private.terminals t on t.store_id=c.store_id and t.id=c.terminal_id where c.session_id=$1`,[actor.sessionId])).rows[0];
  if(companion){if(companion.parent_revoked||new Date(companion.parent_expires)<=new Date()||companion.current_session_id!==companion.approving_session_id)throw new UnauthorizedException('The approving counter session ended. Reconnect with owner approval.');actor.companion={storeId:companion.store_id,terminalId:companion.terminal_id,deviceId:companion.device_id};delete actor.counterToken;}
  const context=await this.db.context(actor);
  if((!context.profile || !context.store) && !context.terminal)throw new UnauthorizedException('Your account is inactive or has no branch access.');
  await this.db.query("update app_private.sessions set last_active_at=now() where id=$1 and last_active_at<now()-interval '1 minute'",[actor.sessionId]);
  return actor;
 }
 private async result(actor:Actor,refreshToken:string){return {refreshToken,body:{accessToken:this.access(actor),expiresIn:900,context:await this.db.context(actor)}};}
 async companionResult(actor:Actor){return {accessToken:this.access(actor),expiresIn:900,context:await this.db.context(actor)};}
 async login(email:string,password:string,ip:string,deviceName:string){
  if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>128)throw new BadRequestException('Enter your email and password.');
  const normalized=email.trim().toLowerCase();const throttle=digestToken(normalized+'|'+ip);const ipThrottle=digestToken('ip:'+ip);
  // Persistent limits survive server restarts. Never disclose whether an email exists.
  const attempts=(await this.db.query(`select failures from app_private.login_attempts where key=$1 and window_started>now()-interval '15 minutes'`,[throttle])).rows[0];
  if(Number(attempts?.failures??0)>=8)throw new UnauthorizedException('Too many attempts. Try again in 15 minutes.');
  const perIp=(await this.db.query(`select failures from app_private.login_attempts where key=$1 and window_started>now()-interval '15 minutes'`,[ipThrottle])).rows[0];
  if(Number(perIp?.failures??0)>=80)throw new UnauthorizedException('Too many attempts. Try again in 15 minutes.');
  await this.db.query(`insert into app_private.login_attempts(key,failures) values($1,1) on conflict(key) do update set failures=case when app_private.login_attempts.window_started<now()-interval '15 minutes' then 1 else app_private.login_attempts.failures+1 end,window_started=case when app_private.login_attempts.window_started<now()-interval '15 minutes' then now() else app_private.login_attempts.window_started end`,[ipThrottle]);
  const account=(await this.db.query('select user_id,password_hash,enabled from app_private.accounts where email=$1',[normalized])).rows[0];
  const valid=account && account.enabled && await verifyPassword(account.password_hash,password);
  if(!valid){
   // A dummy hash prevents a cheap nonexistent-account timing oracle.
   if(!account)await hashPassword(password);
   await this.db.query(`insert into app_private.login_attempts(key,failures) values($1,1) on conflict(key) do update set failures=case when app_private.login_attempts.window_started<now()-interval '15 minutes' then 1 else app_private.login_attempts.failures+1 end,window_started=case when app_private.login_attempts.window_started<now()-interval '15 minutes' then now() else app_private.login_attempts.window_started end`,[throttle]);
   throw new UnauthorizedException('Email or password is incorrect.');
  }
  const actor={userId:account.user_id,sessionId:randomUUID()};const ctx=await this.db.context(actor);
  if((!ctx.profile || !ctx.store) && !ctx.terminal)throw new UnauthorizedException('This account has no active business access.');
  const token=createToken();
  await this.db.transaction(async db=>{
   await db.query('delete from app_private.login_attempts where key=$1',[throttle]);
   await db.query(`insert into app_private.sessions(id,user_id,device_name,ip_hash) values($1,$2,$3,$4)`,[actor.sessionId,actor.userId,deviceName.slice(0,120),digestToken(ip)]);
   await db.query('insert into app_private.refresh_tokens(token_hash,session_id) values($1,$2)',[digestToken(token),actor.sessionId]);
   await db.query("select app_private.auth_audit($1,'auth.signed_in',$2)",[actor.userId,actor.sessionId]);
  });return this.result(actor,token);
 }
 async refresh(token:string,deviceProof=false){
  if(!token||!/^[a-f0-9]{64}$/.test(token))throw new UnauthorizedException('Sign in again.');
  const next=createToken();
  const actor=await this.db.transaction(async db=>{
   const row=(await db.query(`select r.*,s.user_id,s.revoked_at,s.expires_at as session_expires,a.enabled from app_private.refresh_tokens r join app_private.sessions s on s.id=r.session_id join app_private.accounts a on a.user_id=s.user_id where token_hash=$1 for update of r,s`,[digestToken(token)])).rows[0];
   if(!row)return null;
   const companion=(await db.query('select * from app_private.companion_sessions where session_id=$1',[row.session_id])).rows[0];
   if(companion&&!deviceProof)return null;
   if(row.used_at){await db.query('update app_private.sessions set revoked_at=coalesce(revoked_at,now()) where id=$1',[row.session_id]);await db.query("select app_private.auth_audit($1,'auth.refresh_replayed',$2)",[row.user_id,row.session_id]);return null;}
   if(row.revoked_at||!row.enabled||new Date(row.expires_at)<=new Date()||new Date(row.session_expires)<=new Date())return null;
   await db.query('update app_private.refresh_tokens set used_at=now() where token_hash=$1',[digestToken(token)]);
   await db.query('insert into app_private.refresh_tokens(token_hash,session_id) values($1,$2)',[digestToken(next),row.session_id]);
   await db.query('update app_private.sessions set last_active_at=now() where id=$1',[row.session_id]);
   const actor:Actor={userId:row.user_id,sessionId:row.session_id};
   if(companion){const parent=(await db.query('select s.* from app_private.sessions s join app_private.terminals t on t.store_id=$2 and t.id=$3 and t.current_session_id=s.id where s.id=$1',[companion.approving_session_id,companion.store_id,companion.terminal_id])).rows[0];if(!parent||parent.revoked_at||new Date(parent.expires_at)<=new Date())return null;actor.companion={storeId:companion.store_id,terminalId:companion.terminal_id,deviceId:companion.device_id};}
   return actor;
  });
  if(!actor)throw new UnauthorizedException('Your session has ended. Sign in again.');
  const context=await this.db.context(actor);if((!context.profile||!context.store)&&!context.terminal){await this.logout(actor);throw new UnauthorizedException('Account access has ended.');}
  return this.result(actor,next);
 }
 async logout(actor:Actor){await this.db.transaction(async db=>{await db.query('update app_private.sessions set revoked_at=coalesce(revoked_at,now()) where id=$1 and user_id=$2',[actor.sessionId,actor.userId]);await db.query("select app_private.auth_audit($1,'auth.signed_out',$2)",[actor.userId,actor.sessionId]);});}
 async changePassword(actor:Actor,current:string,next:string){
  try{validatePassword(next);}catch(e){throw new BadRequestException((e as Error).message);}
  if(typeof current!=='string')throw new BadRequestException('Enter your current password.');
  const a=(await this.db.query('select password_hash from app_private.accounts where user_id=$1',[actor.userId])).rows[0];
  if(!a||!await verifyPassword(a.password_hash,current))throw new UnauthorizedException('Current password is incorrect.');
  const hash=await hashPassword(next);await this.db.transaction(async db=>{
   await db.query('update app_private.accounts set password_hash=$1,updated_at=now() where user_id=$2',[hash,actor.userId]);
   await db.query('update app_private.sessions set revoked_at=coalesce(revoked_at,now()) where user_id=$1 and id<>$2',[actor.userId,actor.sessionId]);
   await db.query("select app_private.auth_audit($1,'auth.password_changed',$2)",[actor.userId,actor.sessionId]);
  });return {ok:true};
 }
 async devices(actor:Actor){return (await this.db.query('select id,device_name as "deviceName",created_at as "createdAt",last_active_at as "lastActiveAt",(id=$2) as current from app_private.sessions where user_id=$1 and revoked_at is null and expires_at>now() order by last_active_at desc',[actor.userId,actor.sessionId])).rows;}
 async revokeDevice(actor:Actor,id:string){await this.db.transaction(async db=>{const changed=await db.query('update app_private.sessions set revoked_at=coalesce(revoked_at,now()) where id=$1 and user_id=$2 returning id',[id,actor.userId]);if(changed.rowCount)await db.query("select app_private.auth_audit($1,'auth.session_revoked',$2)",[actor.userId,id]);});return {ok:true};}
 async staffAccount(actor:Actor,store:string,profileId:string,email:string,password:string){try{validatePassword(password);}catch(e){throw new BadRequestException((e as Error).message);}const hash=await hashPassword(password);return this.db.asActor(actor,async db=>{await db.query('select public.set_staff_account($1,$2,$3,$4)',[store,profileId,email.trim().toLowerCase(),hash]);return {ok:true};});}
}
