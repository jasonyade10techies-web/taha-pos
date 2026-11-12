import {Inject,Injectable,OnModuleDestroy} from '@nestjs/common';
import {access,mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import path from 'node:path';
import {constants} from 'node:fs';
import {CONFIG,type Configuration} from '../config';
import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand,HeadBucketCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
export interface FileStorage{write(key:string,bytes:Buffer):Promise<void>;read(key:string):Promise<Buffer>;remove(key:string):Promise<void>}
export const MAX_IMAGE_BYTES=16*1024*1024;
@Injectable()
export class LocalFileStorage implements FileStorage,OnModuleDestroy{
 readonly root:string;
 private cloud?:{client:S3Client;bucket:string;region:string;endpoint?:string;accessKey:string;secretKey:string};
 constructor(@Inject(CONFIG) config:Configuration){
  this.root=path.resolve(config.storageRoot);
  if(config.storageDriver==='s3'){
   if(!config.s3Bucket||!config.s3AccessKey||!config.s3SecretKey)throw new Error('Private object storage configuration is incomplete.');
   if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.s3Bucket))throw new Error('Invalid private bucket name.');
   if(config.s3Endpoint){const endpoint=new URL(config.s3Endpoint);if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/'||!['https:','http:'].includes(endpoint.protocol)||(config.production&&endpoint.protocol!=='https:'))throw new Error('Object storage endpoint must be a secure origin.');}
   this.cloud={client:new S3Client({region:config.s3Region,endpoint:config.s3Endpoint,forcePathStyle:Boolean(config.s3Endpoint),credentials:{accessKeyId:config.s3AccessKey,secretAccessKey:config.s3SecretKey}}),bucket:config.s3Bucket,region:config.s3Region,endpoint:config.s3Endpoint,accessKey:config.s3AccessKey,secretKey:config.s3SecretKey};
  }else if(config.storageDriver!=='local')throw new Error('Unsupported storage driver.');
 }
 private file(key:string){const absolute=path.resolve(this.root,key);if(!absolute.startsWith(this.root+path.sep))throw new Error('Invalid storage path.');return absolute;}
 // S3 SigV4 POST, scoped to one object and exact byte count. The provider must
 // support POST policies; a presigned PUT does not enforce content-length-range.
 directUpload(key:string,mimeType:string,size:number,expiresAt:Date,now=new Date()){
  this.file(key);const c=this.cloud;if(!c)return null;
  if(!Number.isInteger(size)||size<1||size>MAX_IMAGE_BYTES||!['image/jpeg','image/png','image/webp'].includes(mimeType)||expiresAt.getTime()<=now.getTime()||expiresAt.getTime()-now.getTime()>300000)throw new Error('Invalid direct upload bounds.');
  const date=now.toISOString().replace(/[:-]|\.\d{3}/g,''),day=date.slice(0,8),scope=`${day}/${c.region}/s3/aws4_request`;
  const fields:Record<string,string>={key,'Content-Type':mimeType,'x-amz-algorithm':'AWS4-HMAC-SHA256','x-amz-credential':`${c.accessKey}/${scope}`,'x-amz-date':date,success_action_status:'204'};
  const policy=Buffer.from(JSON.stringify({expiration:expiresAt.toISOString(),conditions:[{bucket:c.bucket},...Object.entries(fields).map(([k,v])=>({[k]:v})),['content-length-range',size,size]]})).toString('base64');
  const h=(k:Buffer|string,v:string)=>createHmac('sha256',k).update(v).digest();
  const signing=h(h(h(h('AWS4'+c.secretKey,day),c.region),'s3'),'aws4_request');
  fields.policy=policy;fields['x-amz-signature']=createHmac('sha256',signing).update(policy).digest('hex');
  return {url:c.endpoint?`${new URL(c.endpoint).origin}/${c.bucket}`:`https://${c.bucket}.s3.${c.region}.amazonaws.com`,fields};
 }
 async probe(){if(this.cloud){await this.cloud.client.send(new HeadBucketCommand({Bucket:this.cloud.bucket}),{abortSignal:AbortSignal.timeout(3000)});return;}await mkdir(this.root,{recursive:true});await access(this.root,constants.R_OK|constants.W_OK);}
 async probePrivateStorage(){
  const key='diagnostics/health-'+randomUUID(),bytes=randomBytes(32);
  try{
   if(this.cloud)await this.cloud.client.send(new PutObjectCommand({Bucket:this.cloud.bucket,Key:key,Body:bytes,ContentType:'application/octet-stream',IfNoneMatch:'*'}),{abortSignal:AbortSignal.timeout(3000)});
   else await this.write(key,bytes);
   if(!(await this.readBounded(key,64,3000)).equals(bytes))throw new Error('Private storage verification failed.');
   if(this.cloud){
    const c=this.cloud,origin=c.endpoint?`${new URL(c.endpoint).origin}/${c.bucket}`:`https://${c.bucket}.s3.${c.region}.amazonaws.com`;
    const anonymous=await fetch(origin+'/'+key,{redirect:'error',signal:AbortSignal.timeout(3000)});
    await anonymous.body?.cancel();
    if(![401,403,404].includes(anonymous.status))throw new Error('The diagnostic object is not private.');
   }
  }finally{
   // Delete only this newly generated diagnostic key, even after a lost PUT ack.
   if(this.cloud)await this.cloud.client.send(new DeleteObjectCommand({Bucket:this.cloud.bucket,Key:key}),{abortSignal:AbortSignal.timeout(3000)});
   else await this.remove(key);
  }
 }
 onModuleDestroy(){this.cloud?.client.destroy();}
 async objectStatus(key:string):Promise<'present'|'missing'|'unavailable'>{
  const file=this.file(key);try{
   if(this.cloud)await this.cloud.client.send(new HeadObjectCommand({Bucket:this.cloud.bucket,Key:key}),{abortSignal:AbortSignal.timeout(3000)});
   else await access(file,constants.R_OK);
   return 'present';
  }catch(cause){const error=cause as {code?:string;$metadata?:{httpStatusCode?:number}};return error.code==='ENOENT'||error.$metadata?.httpStatusCode===404?'missing':'unavailable';}
 }
 async write(key:string,bytes:Buffer){const file=this.file(key);if(this.cloud){await this.cloud.client.send(new PutObjectCommand({Bucket:this.cloud.bucket,Key:key,Body:bytes,ContentType:'application/octet-stream',IfNoneMatch:'*'}),{abortSignal:AbortSignal.timeout(20000)});return;}await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'});}
 async read(key:string){return this.readBounded(key,MAX_IMAGE_BYTES);}
 async readBounded(key:string,maxBytes:number,timeout=20000){
  const file=this.file(key);if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>MAX_IMAGE_BYTES)throw new Error('Invalid object size limit.');
  if(!this.cloud){const value=await readFile(file);if(value.length>maxBytes)throw new Error('Image is too large.');return value;}
  const abort=AbortSignal.timeout(timeout);
  const result=await this.cloud.client.send(new GetObjectCommand({Bucket:this.cloud.bucket,Key:key}),{abortSignal:abort});
  if(!result.Body)throw new Error('Image unavailable');
  const body=result.Body as AsyncIterable<Uint8Array>&{destroy?:()=>void};
  const cancelled=()=>body.destroy?.();abort.addEventListener('abort',cancelled,{once:true});
  try{if(result.ContentLength!==undefined&&result.ContentLength>maxBytes)throw new Error('Image is too large.');
   const chunks:Buffer[]=[];let length=0;for await(const chunk of body){length+=chunk.length;if(length>maxBytes)throw new Error('Image is too large.');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks,length);
  }finally{abort.removeEventListener('abort',cancelled);body.destroy?.();}
 }
 async remove(key:string){const file=this.file(key);if(this.cloud){await this.cloud.client.send(new DeleteObjectCommand({Bucket:this.cloud.bucket,Key:key}),{abortSignal:AbortSignal.timeout(20000)});return;}try{await unlink(file);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
}

