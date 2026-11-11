import {BadRequestException,ConflictException,ForbiddenException,GoneException,HttpException,Inject,Injectable,NotFoundException} from '@nestjs/common';
import {randomUUID,createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {CounterGateway} from '../realtime/counter.gateway';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import {Database,type Actor} from '../database/database.service';
import {AuthService} from '../auth/auth.service';
import {CameraService,cameraType} from '../camera/camera.service';
import {LocalFileStorage} from './file-storage';
import {CONFIG,type Configuration} from '../config';
import {uuid} from '../business/business.service';
const kinds:Record<string,{folder:string,bucket:string,write:string[],read:string[]}>={
 product:{folder:'',bucket:'product-images',write:['products.create','products.edit'],read:['inventory.view','sales.create','products.create','products.edit']},
 customer:{folder:'customers',bucket:'business-assets',write:['customers.create','customers.edit'],read:['customers.view','sales.create','customers.edit','credit.create','credit.receive_payment']},
 profile:{folder:'profile',bucket:'business-assets',write:['media.upload'],read:[]},
 proof:{folder:'proof',bucket:'business-assets',write:['sales.create','credit.receive_payment'],read:['payments.approve_electronic','payments.reverse','reports.view']},
 device:{folder:'',bucket:'product-images',write:['devices.buy_used'],read:['devices.buy_used','sales.create']},
 repair:{folder:'repair',bucket:'business-assets',write:['repairs.create','repairs.edit'],read:['repairs.view']},
 damage:{folder:'damage',bucket:'business-assets',write:['inventory.adjust'],read:['inventory.view']},
 document:{folder:'documents',bucket:'business-assets',write:['media.upload'],read:['media.upload']},
 'payment-qr':{folder:'payment-qr',bucket:'business-assets',write:['settings.manage'],read:['sales.create','settings.manage']},
};
@Injectable()
export class MediaService{
 constructor(@Inject(Database) private readonly db:Database,@Inject(LocalFileStorage) private readonly storage:LocalFileStorage,@Inject(AuthService) private readonly auth:AuthService,@Inject(CameraService) private readonly camera:CameraService,@Inject(CONFIG) private readonly config:Configuration,@Inject(CounterGateway) private readonly realtime:CounterGateway){}
 private async permit(actor:Actor,store:string,keys:string[]){if((await this.db.context(actor)).store?.id!==store)return false;for(const key of keys)if(await this.db.permission(actor,key,store))return true;return false;}
 private kind(input:string){const t=cameraType(input);return t==='payment-proof'?'proof':t;}
 private validateFile(file:Express.Multer.File){
  if(!file)throw new BadRequestException('Choose an image or take a photo.');
  if(!Buffer.isBuffer(file.buffer)||!Number.isInteger(file.size)||file.size<1||file.size>16*1024*1024||file.buffer.length<1||file.buffer.length>16*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.mimetype))throw new BadRequestException('Use a JPG, PNG or WebP image smaller than 16 MB.');
 }
 private directActor(actor:Actor){if(actor.companion)throw new ForbiddenException('Use an authorized staff browser account for direct image uploads.');}
 private async grantScope(actor:Actor,store:string,b:{kind:string;entityId?:string;staged?:boolean}){
  this.directActor(actor);uuid(store);
  const kind=this.kind(b.kind),rule=kinds[kind],context=await this.db.context(actor);
  if(!context.profile?.id||context.store?.id!==store)throw new ForbiddenException('Branch access required.');
  if(!rule||!await this.permit(actor,store,rule.write))throw new ForbiddenException('You cannot upload this type of image.');
  if(kind==='profile'&&(context.terminal||b.entityId&&b.entityId!==context.profile.id))throw new ForbiddenException('Use your individual account for your own profile photo.');
  if(b.entityId&&(typeof b.entityId!=='string'||b.entityId.length>120))throw new BadRequestException('Invalid image attachment reference.');
  // A draft photo is unbound until the business operation saves it. IDs hidden
  // by shop RLS are also left unbound, never attached to another shop's record.
  let attachmentId=b.entityId;
  const table=kind==='product'?'products':kind==='device'?'purchased_devices':kind==='customer'?'customers':kind==='repair'?'repair_jobs':undefined;
  if(b.entityId&&table&&!(b.staged&&kind==='product')){
   uuid(b.entityId);const found=await this.db.asActor(actor,async db=>(await db.query(`select 1 from public.${table} where id=$1 and store_id=$2`,[b.entityId,store])).rowCount);
   if(!found)attachmentId=undefined;
  }
  if(b.staged&&kind==='product')attachmentId=undefined;
  return {kind,profileId:context.profile.id as string,attachmentId};
 }
 async createGrant(actor:Actor,store:string,b:{uploadId:string;kind:string;mimeType:string;size:number;sha256:string;entityId?:string;staged?:boolean;cameraJobId?:string}){
  this.directActor(actor);
  if(!b||typeof b.kind!=='string')throw new BadRequestException('Choose an image purpose.');
  const scope=await this.grantScope(actor,store,b);
  if(this.config.storageDriver!=='s3')return {mode:'multipart' as const};
  if(b.cameraJobId)throw new BadRequestException('Camera requests use the protected camera upload flow.');
  uuid(b.uploadId);
  if(!Number.isInteger(b.size)||b.size<1||b.size>16*1024*1024||!['image/jpeg','image/png','image/webp'].includes(b.mimeType)||typeof b.sha256!=='string'||!/^[a-f0-9]{64}$/.test(b.sha256)||b.staged!==undefined&&typeof b.staged!=='boolean')throw new BadRequestException('Use a JPG, PNG or WebP image smaller than 16 MB.');
  const params={kind:scope.kind,entityId:b.entityId||undefined,staged:b.staged===true};
  const hash=createHash('sha256').update(JSON.stringify({...params,mimeType:b.mimeType,size:b.size,sha256:b.sha256})).digest('hex');
  const row=await this.db.transaction(async db=>{
   // Different request IDs share one profile quota. Serialize its count/insert
   // across API instances as well as retries of a single grant.
   await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${store}:${scope.profileId}:direct`]);
   const previous=(await db.query('select * from app_private.media_upload_grants where store_id=$1 and profile_id=$2 and request_id=$3 for update',[store,scope.profileId,b.uploadId])).rows[0];
   if(previous){
    if(previous.input_hash!==hash||previous.status==='cancelled')throw new ConflictException('This upload reference was used for another image or was cancelled.');
    if(previous.status==='completed')return previous;
    if(new Date(previous.expires_at)>new Date())return previous;
   }
   const count=(await db.query("select count(*) filter(where status='pending' and expires_at>now())::int pending,count(*) filter(where created_at>now()-interval '15 minutes')::int recent from app_private.media_upload_grants where store_id=$1 and profile_id=$2",[store,scope.profileId])).rows[0];
   if(count.pending>=8||!previous&&count.recent>=32)throw new HttpException('Finish or cancel pending photos before uploading more.',429);
   const expires=new Date(Date.now()+300000),key=`staging/${store}/${scope.profileId}/${randomUUID()}`;
   if(previous)return (await db.query("update app_private.media_upload_grants set object_key=$1,expires_at=$2,updated_at=now() where id=$3 returning *",[key,expires,previous.id])).rows[0];
   return (await db.query('insert into app_private.media_upload_grants(store_id,profile_id,request_id,input_hash,object_key,params,expected_size,expected_sha256,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[store,scope.profileId,b.uploadId,hash,key,{...params,mimeType:b.mimeType},b.size,b.sha256,expires])).rows[0];
  });
  if(row.status==='completed'){
   const available=(await this.db.query('select 1 from app_private.media where id=$1 and deleted_at is null',[row.media_id])).rowCount;
   if(!available)throw new ConflictException('This uploaded image has been removed.');
   return {mode:'completed' as const,id:row.id,result:{...row.result,url:this.url(actor,row.media_id,scope.profileId)}};
  }
  const direct=this.storage.directUpload(row.object_key,row.params.mimeType,row.expected_size,new Date(row.expires_at));
  if(!direct)throw new BadRequestException('Private direct storage is unavailable.');
  return {mode:'direct' as const,id:row.id,expiresAt:new Date(row.expires_at).toISOString(),...direct};
 }
 async completeGrant(actor:Actor,store:string,id:string){
  this.directActor(actor);uuid(store);uuid(id);const context=await this.db.context(actor);
  if(!context.profile?.id||context.store?.id!==store)throw new ForbiddenException('Branch access required.');
  const permitted=(await this.db.query('select * from app_private.media_upload_grants where id=$1 and store_id=$2 and profile_id=$3',[id,store,context.profile.id])).rows[0];
  if(!permitted)throw new NotFoundException('Upload not found.');
  const verified=await this.grantScope(actor,store,permitted.params);
  let written:Awaited<ReturnType<MediaService['upload']>>|undefined,objectKey:string|undefined,kind:string|undefined;
  let result:Awaited<ReturnType<MediaService['upload']>>;
  try{result=await this.db.transaction(async db=>{
   const row=(await db.query('select * from app_private.media_upload_grants where id=$1 and store_id=$2 and profile_id=$3 for update',[id,store,context.profile.id])).rows[0];
   if(!row)throw new NotFoundException('Upload not found.');
   if(row.status==='cancelled')throw new ConflictException('This upload was cancelled.');
   if(row.status==='completed'){
    const available=(await db.query('select 1 from app_private.media where id=$1 and deleted_at is null',[row.media_id])).rowCount;
    if(!available)throw new ConflictException('This uploaded image has been removed.');
    return {...row.result,url:this.url(actor,row.media_id,context.profile.id)};
   }
   if(new Date(row.expires_at)<=new Date())throw new GoneException('This upload expired. Retry the photo to request a new grant.');
   let bytes:Buffer;
   try{bytes=await this.storage.readBounded(row.object_key,row.expected_size);}catch{throw new BadRequestException('Upload is missing or too large. Retry the photo.');}
   if(bytes.length!==row.expected_size||createHash('sha256').update(bytes).digest('hex')!==row.expected_sha256)throw new BadRequestException('Uploaded content does not match this photo grant.');
   try{const metadata=await sharp(bytes,{limitInputPixels:50000000,animated:false}).metadata();const format=({ 'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'} as Record<string,string>)[row.params.mimeType];if(metadata.format!==format||(metadata.pages??1)>1)throw new Error();}catch{throw new BadRequestException('This image could not be opened. Try another image.');}
   kind=row.params.kind;
   written=await this.persistImage(actor,store,{buffer:bytes,size:bytes.length,mimetype:row.params.mimeType} as Express.Multer.File,{kind:row.params.kind,entityId:verified.attachmentId,staged:row.params.staged?'true':undefined},{profileId:context.profile.id,uploadedBy:context.profile.id},db);
   const {url:_url,timings:_timings,...safe}=written;
   await db.query('insert into app_private.media_uploads(store_id,profile_id,request_id,input_hash,media_id,result) values($1,$2,$3,$4,$5,$6)',[store,context.profile.id,row.request_id,row.input_hash,written.id,safe]);
   await db.query("update app_private.media_upload_grants set status='completed',media_id=$1,result=$2,updated_at=now() where id=$3",[written.id,safe,id]);
   objectKey=row.object_key;return written;
  });}catch(error){if(written&&kind){const key=kinds[kind].bucket+'/'+written.path;await Promise.allSettled([this.storage.remove(key),this.storage.remove(key+'.original'),this.storage.remove(key+'.thumb.webp')]);}throw error;}
  // The finalized immutable object is separate from the replayable staging key.
  // A provider lifecycle on staging/ removes interrupted or replayed leftovers.
  if(objectKey)await this.storage.remove(objectKey).catch(()=>undefined);
  if(written)await this.audit(actor,store,'media.uploaded',written.id,{kind,directUpload:true});
  return result;
 }
 async cancelGrant(actor:Actor,store:string,id:string){
  this.directActor(actor);uuid(store);uuid(id);const context=await this.db.context(actor);
  if(!context.profile?.id||context.store?.id!==store)throw new ForbiddenException('Branch access required.');
  const row=await this.db.transaction(async db=>{
   const grant=(await db.query('select * from app_private.media_upload_grants where id=$1 and store_id=$2 and profile_id=$3 for update',[id,store,context.profile.id])).rows[0];
   if(!grant)throw new NotFoundException('Upload not found.');if(grant.status==='completed')throw new ConflictException('This upload is already complete.');
   await db.query("update app_private.media_upload_grants set status='cancelled',updated_at=now() where id=$1",[id]);return grant;
  });await this.storage.remove(row.object_key).catch(()=>undefined);return {ok:true};
 }

 async upload(actor:Actor,store:string,file:Express.Multer.File,b:{kind:string,entityId?:string,cameraJobId?:string,sortOrder?:string,primary?:string,staged?:string,uploadId?:string},captureDb?:PoolClient):Promise<{id:string;path:string;url:string;mimeType:string;size:number;width:number;height:number;timings?:{receivedAt:string;processingMs:number;thumbnailMs:number;storageMs:number}}>{
  if(actor.companion&&!b?.cameraJobId)this.directActor(actor);
  uuid(store);this.validateFile(file);
  if(!b||typeof b.kind!=='string')throw new BadRequestException('Choose an image purpose.');
  const kind=this.kind(b.kind);const rule=kinds[kind];if(!rule)throw new BadRequestException('Invalid image type.');
  const context=await this.db.context(actor);let pid=context.profile?.id as string;
  if(!pid||context.store?.id!==store)throw new ForbiddenException('Branch access required.');
  let job:Record<string,unknown>|undefined;
  if(b.cameraJobId){job=await this.camera.job(actor,store,b.cameraJobId,true);if(this.kind(String(job.type))!==kind)throw new BadRequestException('This photo type does not match its camera request.');pid=String(job.requester_id);}
  else if(!await this.permit(actor,store,rule.write))throw new ForbiddenException('You cannot upload this type of image.');
  if(b.uploadId&&!captureDb){
   uuid(b.uploadId);
   const hash=createHash('sha256').update(file.buffer).update(JSON.stringify({kind,entity:b.entityId||'',camera:b.cameraJobId||'',staged:b.staged==='true',mime:file.mimetype})).digest('hex');
   let written:Awaited<ReturnType<MediaService['upload']>>|undefined,result:Awaited<ReturnType<MediaService['upload']>>;
   try{result=await this.db.transaction(async db=>{
    await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${store}:${context.profile.id}:${b.uploadId}`]);
    const prior=(await db.query('select u.*,m.deleted_at from app_private.media_uploads u join app_private.media m on m.id=u.media_id where u.store_id=$1 and u.profile_id=$2 and u.request_id=$3',[store,context.profile.id,b.uploadId])).rows[0];
    if(prior){if(prior.input_hash!==hash||prior.deleted_at)throw new ConflictException('This photo reference was used for a different or removed image.');return {...prior.result,url:this.url(actor,prior.media_id,context.profile.id)};}
    written=await this.persistImage(actor,store,file,{...b,uploadId:undefined},{profileId:pid,uploadedBy:context.profile.id,job},db);
    const {url:_url,timings:_timings,...result}=written;
    await db.query('insert into app_private.media_uploads(store_id,profile_id,request_id,input_hash,media_id,result) values($1,$2,$3,$4,$5,$6)',[store,context.profile.id,b.uploadId,hash,written.id,result]);
    return written;
   });}catch(error){if(written){const key=rule.bucket+'/'+written.path;await Promise.all([this.storage.remove(key),this.storage.remove(key+'.original'),this.storage.remove(key+'.thumb.webp')]);}throw error;}
   if(written)await this.audit(actor,store,'media.uploaded',written.id,{kind,cameraJobId:b.cameraJobId??null});return result;
  }
  const result=await this.persistImage(actor,store,file,b,{profileId:pid,uploadedBy:context.profile.id,job},captureDb);
  await this.audit(actor,store,'media.uploaded',result.id,{kind,cameraJobId:b.cameraJobId??null});
  return result;
 }
 private async persistImage(actor:Actor,store:string,file:Express.Multer.File,b:Parameters<MediaService['upload']>[3],scope:{profileId:string;uploadedBy:string;job?:Record<string,unknown>},captureDb?:PoolClient):ReturnType<MediaService['upload']>{
  const started=performance.now(),receivedAt=new Date().toISOString(),kind=this.kind(b.kind),rule=kinds[kind],pid=scope.profileId,job=scope.job;
  this.validateFile(file);
  let output:Buffer,width:number,height:number;
  try{const image=sharp(file.buffer,{limitInputPixels:50000000,animated:false});const metadata=await image.metadata();if(!['jpeg','png','webp'].includes(metadata.format??''))throw new Error('Unsupported image');const edge=kind==='proof'||kind==='document'?2400:kind==='profile'?640:1800;const r=await image.rotate().resize({width:edge,height:edge,fit:'inside',withoutEnlargement:true}).webp({quality:kind==='proof'||kind==='document'?92:82}).toBuffer({resolveWithObject:true});output=r.data;width=r.info.width;height=r.info.height;}catch{throw new BadRequestException('This image could not be opened. Try another image.');}
  if(output.length>2*1024*1024)throw new BadRequestException('The image is too large after compression. Choose a smaller image.');
  const processingMs=Math.round(performance.now()-started);let thumbnailMs=0,storageMs=0;const id=randomUUID(),entityId=job?(job.entity_id?String(job.entity_id):undefined):b.entityId;
  if(entityId&&entityId.length>120)throw new BadRequestException('Invalid image attachment reference.');
  // Product paths retain the original engine's stable UUID path contract.
  const entityUuid=entityId&&/^[0-9a-f-]{36}$/i.test(entityId)?entityId:randomUUID();
  const storagePath=rule.folder?`${store}/${rule.folder}/${id}.webp`:`${store}/${entityUuid}/${id}.webp`;
  const fileKey=rule.bucket+'/'+storagePath;
  try{const thumbStart=performance.now();const thumbnail=await sharp(output).resize({width:360,height:360,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();thumbnailMs=Math.round(performance.now()-thumbStart);const storeStart=performance.now();const writes=await Promise.allSettled([this.storage.write(fileKey,output),this.storage.write(fileKey+'.original',file.buffer),this.storage.write(fileKey+'.thumb.webp',thumbnail)]);const failed=writes.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;storageMs=Math.round(performance.now()-storeStart);
  const write=async(db:PoolClient)=>{
   await db.query('insert into app_private.media(id,store_id,profile_id,kind,entity_id,camera_job_id,path,mime_type,size,width,height,sort_order,is_primary,uploaded_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[id,store,pid,kind,b.staged==='true'&&kind==='product'?null:entityId??null,b.cameraJobId??null,storagePath,'image/webp',output.length,width,height,Math.max(0,Number(b.sortOrder??0)),b.primary==='true',scope.uploadedBy]);
   await db.query('insert into storage.objects(id,bucket_id,name) values($1,$2,$3)',[id,rule.bucket,storagePath]);
   await db.query('update app_private.media set original_mime=$1 where id=$2',[file.mimetype,id]);
  };if(captureDb)await write(captureDb);else await this.db.transaction(write);}catch(e){await this.storage.remove(fileKey);await this.storage.remove(fileKey+'.thumb.webp');await this.storage.remove(fileKey+'.original');throw e;}
  return {id,path:storagePath,url:this.url(actor,id,scope.uploadedBy),mimeType:'image/webp',size:output.length,width,height,timings:{receivedAt,processingMs,thumbnailMs,storageMs}};
 }
 async capture(actor:Actor,store:string,id:string,file:Express.Multer.File,captureId:string){
  uuid(captureId);const permitted=await this.camera.job(actor,store,id),context=await this.db.context(actor);
  if(permitted.device_session_id!==actor.sessionId)throw new ForbiddenException('This photo request belongs to another phone.');
  this.validateFile(file);
  const inputHash=createHash('sha256').update(file.buffer).digest('hex');let written:{path:string;id:string;timings?:{receivedAt:string;processingMs:number;thumbnailMs:number;storageMs:number}}|undefined;
  try{await this.db.transaction(async db=>{
    const job=(await db.query('select * from app_private.camera_jobs where id=$1 for update',[id])).rows[0];
    if(job.device_session_id!==actor.sessionId||job.device_profile_id!==context.profile.id)throw new ForbiddenException('This photo request belongs to another phone.');
    const prior=(await db.query('select * from app_private.camera_captures where id=$1',[captureId])).rows[0];
    if(prior){if(prior.job_id!==id||prior.input_hash!==inputHash)throw new ConflictException('This capture was already used for a different photo.');return;}
    if(['received','cancelled'].includes(job.status)||new Date(job.expires_at)<=new Date())throw new BadRequestException(job.status==='cancelled'?'This photo request was cancelled.':new Date(job.expires_at)<=new Date()?'This photo request has expired.':'This photo request is already complete.');
    const count=Number((await db.query('select count(*) n from app_private.camera_captures where job_id=$1',[id])).rows[0].n);
    if(count>=job.max_captures)throw new BadRequestException('This photo session is full.');
    written=await this.persistImage(actor,store,file,{kind:job.type,cameraJobId:id},{profileId:job.requester_id,uploadedBy:context.profile.id,job},db);
    await db.query('insert into app_private.camera_captures(id,job_id,media_id,uploaded_by,input_hash) values($1,$2,$3,$4,$5)',[captureId,id,written.id,job.device_profile_id,inputHash]);
    await db.query("update app_private.camera_jobs set media_id=$1,status=$2,updated_at=now() where id=$3",[written.id,job.max_captures===1||count+1>=job.max_captures?'received':'opened',id]);
  });}catch(cause){if(written){const kind=this.kind(String(permitted.type));const key=kinds[kind].bucket+'/'+written.path;await this.storage.remove(key);await this.storage.remove(key+'.thumb.webp');await this.storage.remove(key+'.original');}throw cause;}
  if(written)await this.audit(actor,store,'media.uploaded',written.id,{kind:permitted.type,cameraJobId:id});
  const job=await this.camera.job(actor,store,id);await this.realtime.camera(job,'camera.request.completed');await this.realtime.camera(job,'camera.completed');
  const result=await this.camera.safe(job,actor);return {...result,timings:written?.timings,capture:result.captures.find(c=>c.captureId===captureId)};
 }
 async removeDiagnostic(actor:Actor,store:string,id:string){const job=await this.camera.job(actor,store,id);if(!job.diagnostic||job.requester_session_id!==actor.sessionId)throw new ForbiddenException('Only your temporary test photo can be removed here.');
  const rows=(await this.db.query('update app_private.media set deleted_at=now() where camera_job_id=$1 returning *',[id])).rows;await this.db.query("update app_private.camera_jobs set status='cancelled',updated_at=now() where id=$1",[id]);for(const row of rows){const key=kinds[row.kind].bucket+'/'+row.path;await this.storage.remove(key);await this.storage.remove(key+'.thumb.webp');await this.storage.remove(key+'.original');}await this.audit(actor,store,'camera.test.deleted',id,{});return {ok:true};
 }
 private url(actor:Actor,id:string,pid?:string){const token=jwt.sign({mid:id,sid:actor.sessionId,pid},this.config.secret,{subject:actor.userId,algorithm:'HS256',expiresIn:300,audience:'taha-pos-media',issuer:'taha-pos'});const origin=actor.companion?process.env.TAHA_LAN_TLS_ORIGIN:this.config.publicUrl;return `${origin}/api/v1/media/${id}?token=${encodeURIComponent(token)}`;}
 private async allowed(actor:Actor,row:Record<string,unknown>,capabilityProfile?:string){
  if(actor.companion){
   if(row.store_id!==actor.companion.storeId||!row.camera_job_id)return false;
   try{await this.camera.job(actor,String(row.store_id),String(row.camera_job_id));return true;}catch{return false;}
  }
  if(capabilityProfile){
   const valid=(await this.db.query('select app_private.media_profile_context($1,$2,$3) value',[actor.userId,capabilityProfile,row.store_id])).rows[0].value;if(!valid)return false;
   if(row.camera_job_id){try{await this.camera.job(actor,String(row.store_id),String(row.camera_job_id));return true;}catch{return false;}}
   if(row.kind==='profile')return row.profile_id===capabilityProfile||Boolean((await this.db.query('select app_private.media_profile_permission($1,$2,$3) value',[capabilityProfile,row.store_id,['employees.view']])).rows[0].value);
   if(row.profile_id===capabilityProfile)return true;
   return Boolean((await this.db.query('select app_private.media_profile_permission($1,$2,$3) value',[capabilityProfile,row.store_id,kinds[String(row.kind)]?.read??[]])).rows[0].value);
  }
  if((await this.db.context(actor)).store?.id!==row.store_id)return false;
  if(row.camera_job_id){try{await this.camera.job(actor,String(row.store_id),String(row.camera_job_id));return true;}catch{return false;}}
  if(row.kind==='profile')return row.profile_id===(await this.db.context(actor)).profile?.id||this.permit(actor,String(row.store_id),['employees.view']);
  if(row.profile_id===(await this.db.context(actor)).profile?.id)return true;
  return this.permit(actor,String(row.store_id),kinds[String(row.kind)]?.read??[]);
 }
 async urls(actor:Actor,store:string,paths:string[]){uuid(store);if(!Array.isArray(paths)||paths.length>500)throw new BadRequestException('Too many image references.');const rows=(await this.db.query('select * from app_private.media where store_id=$1 and path=any($2::text[]) and deleted_at is null',[store,paths])).rows;const result:Record<string,string>={};const pid=(await this.db.context(actor)).profile?.id;for(const row of rows)if(await this.allowed(actor,row))result[row.path]=this.url(actor,row.id,pid);return result;}
 async read(id:string,token:string,thumbnail=false,original=false,secureTransport=false){uuid(id);let p:jwt.JwtPayload;try{p=jwt.verify(token,this.config.secret,{audience:'taha-pos-media',issuer:'taha-pos',algorithms:['HS256']}) as jwt.JwtPayload;if(p.mid!==id||typeof p.sub!=='string'||typeof p.sid!=='string')throw new Error();}catch{throw new ForbiddenException('This image link expired. Refresh the page.');}
  const bearer=jwt.sign({sid:p.sid},this.config.secret,{subject:p.sub,algorithm:'HS256',expiresIn:30,audience:'taha-pos-api',issuer:'taha-pos'});const actor=await this.auth.authenticate(bearer);
  if(actor.companion&&!secureTransport)throw new ForbiddenException('Connect through the protected shop HTTPS address.');
  const row=(await this.db.query('select * from app_private.media where id=$1 and deleted_at is null',[id])).rows[0];if(!row||!await this.allowed(actor,row,typeof p.pid==='string'?p.pid:undefined))throw new NotFoundException('Image not found.');const root=original&&row.original_media_id?(await this.db.query('select * from app_private.media where id=$1',[row.original_media_id])).rows[0]:row;const key=kinds[root.kind].bucket+'/'+root.path;return {buffer:original?await this.storage.read(key+'.original').catch(()=>this.storage.read(key)):thumbnail?await this.storage.read(key+'.thumb.webp').catch(async()=>sharp(await this.storage.read(key)).resize({width:360,height:360,fit:'inside'}).webp().toBuffer()):await this.storage.read(key),mimeType:original?(root.original_mime||root.mime_type):row.mime_type};
 }
 async crop(actor:Actor,store:string,b:{path:string;crop:{x:number;y:number;width:number;height:number;rotation:number};staged?:boolean}){uuid(store);const row=(await this.db.query('select * from app_private.media where store_id=$1 and path=$2 and deleted_at is null',[store,b.path])).rows[0];if(!row||!['product','device','repair','profile','customer'].includes(row.kind)||!await this.allowed(actor,row)||!await this.permit(actor,store,kinds[row.kind].write))throw new ForbiddenException('You cannot edit this image.');const c=b.crop;if(!c||![c.x,c.y,c.width,c.height,c.rotation].every(Number.isFinite)||c.x<0||c.y<0||c.width<=0||c.height<=0||c.x+c.width>1.00001||c.y+c.height>1.00001||![0,90,180,270].includes(c.rotation))throw new BadRequestException('Invalid crop.');
 const root=row.original_media_id?(await this.db.query('select * from app_private.media where id=$1 and store_id=$2',[row.original_media_id,store])).rows[0]:row;const key=kinds[root.kind].bucket+'/'+root.path;const input=await this.storage.read(key+'.original').catch(()=>this.storage.read(key));const oriented=await sharp(input,{limitInputPixels:50000000}).rotate().toBuffer();const rotated=await sharp(oriented).rotate(c.rotation).toBuffer({resolveWithObject:true});const w=rotated.info.width,h=rotated.info.height,left=Math.floor(c.x*w),top=Math.floor(c.y*h),width=Math.max(1,Math.min(w-left,Math.round(c.width*w))),height=Math.max(1,Math.min(h-top,Math.round(c.height*h)));const buffer=await sharp(rotated.data).extract({left,top,width,height}).webp({quality:95}).toBuffer();const result=await this.upload(actor,store,{buffer,size:buffer.length,mimetype:'image/webp'} as Express.Multer.File,{kind:row.kind,entityId:row.entity_id||undefined,staged:b.staged?'true':undefined});await this.db.query('update app_private.media set original_media_id=$1,crop=$2 where id=$3',[root.id,c,result.id]);return {...result,crop:c};
 }
 async list(actor:Actor,store:string,kind:string,entityId:string){uuid(store);const normalized=this.kind(kind);const rows=(await this.db.query('select * from app_private.media where store_id=$1 and kind=$2 and entity_id=$3 and deleted_at is null order by is_primary desc,sort_order,created_at',[store,normalized,entityId])).rows;const output=[];const pid=(await this.db.context(actor)).profile?.id;for(const row of rows)if(await this.allowed(actor,row))output.push({id:row.id,path:row.path,url:this.url(actor,row.id,pid),primary:row.is_primary,sortOrder:row.sort_order,width:row.width,height:row.height,crop:row.crop||undefined,originalUrl:row.original_media_id?'taha-media:'+(await this.db.query('select path from app_private.media where id=$1',[row.original_media_id])).rows[0]?.path:undefined});return output;}
 async metadata(actor:Actor,store:string,id:string,b:{sortOrder?:number,primary?:boolean,entityId?:string|null}){
  uuid(store);uuid(id);const row=(await this.db.query('select * from app_private.media where id=$1 and store_id=$2 and deleted_at is null',[id,store])).rows[0];
  if(!row||!await this.permit(actor,store,kinds[row.kind]?.write??[]))throw new ForbiddenException();
  const detach=Object.hasOwn(b,'entityId')&&b.entityId===null;
  if(detach&&!['product','device','customer'].includes(row.kind))throw new BadRequestException('This evidence is attached to its business record and cannot be detached.');
  if(b.entityId&&b.entityId.length>120||b.sortOrder!==undefined&&(!Number.isInteger(b.sortOrder)||b.sortOrder<0||b.sortOrder>10000))throw new BadRequestException('Invalid image order.');
  await this.db.transaction(async db=>{if(b.primary&&!detach)await db.query('update app_private.media set is_primary=false where store_id=$1 and kind=$2 and entity_id=$3',[store,row.kind,b.entityId??row.entity_id]);await db.query('update app_private.media set entity_id=case when $5 then $1::text else entity_id end,sort_order=coalesce($2,sort_order),is_primary=case when $6 then false else coalesce($3,is_primary) end where id=$4',[b.entityId??null,b.sortOrder??null,b.primary??null,id,Object.hasOwn(b,'entityId'),detach]);});await this.audit(actor,store,'media.attached',id,{kind:row.kind,detached:detach});return {ok:true};
 }
 async remove(actor:Actor,store:string,id:string){uuid(store);uuid(id);if(!await this.permit(actor,store,['media.delete']))throw new ForbiddenException('Image deletion permission required.');
  const row=(await this.db.query('select * from app_private.media where id=$1 and store_id=$2 and deleted_at is null',[id,store])).rows[0];if(!row)throw new NotFoundException();
  // Keep financial evidence immutable; referenced customer/catalog/profile photos are replaced before deleting old files.
  const referenced=(await this.db.query('select app_private.media_referenced($1) value',[id])).rows[0].value;
  const derivatives=(await this.db.query('select 1 from app_private.media where original_media_id=$1 and deleted_at is null limit 1',[id])).rowCount;
  if(row.kind==='proof'||referenced||row.camera_job_id||derivatives)throw new BadRequestException('This image is attached to a business record and cannot be deleted.');
  await this.db.query('update app_private.media set deleted_at=now() where id=$1',[id]);const key=kinds[row.kind].bucket+'/'+row.path;await this.storage.remove(key);await this.storage.remove(key+'.thumb.webp');await this.storage.remove(key+'.original');await this.audit(actor,store,'media.deleted',id,{kind:row.kind});return {ok:true};
 }
 async avatar(actor:Actor,path:string){const context=await this.db.context(actor);if(!context.profile||context.terminal)throw new ForbiddenException('Use your individual account to change your photo.');
  if(path){const row=(await this.db.query("select 1 from app_private.media where path=$1 and kind='profile' and profile_id=$2 and deleted_at is null",[path,context.profile.id])).rowCount;if(!row)throw new BadRequestException('Select your uploaded profile photo.');}
  await this.db.query('select app_private.set_avatar($1,$2)',[context.profile.id,path||null]);return {ok:true};
 }
 async audit(actor:Actor,store:string,action:string,id:string,metadata:unknown){await this.db.asActor(actor,async db=>{await db.query('select public.log_media_event($1,$2,$3,$4)',[store,action,id,metadata]);});}
}

