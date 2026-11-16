import {createHash} from 'node:crypto';
import {releaseKey,readJson,verifiedAsset} from './release-store.mjs';
import {s3ReleaseStore} from './s3-store.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function s3ReleaseWriter(options){
 const {client,bucket,PutObjectCommand}=options,store=s3ReleaseStore(options),prefix='software-releases/v1/';
 const missing=error=>error?.$metadata?.httpStatusCode===404||['NoSuchKey','NotFound'].includes(error?.name);
 const collision=error=>[409,412].includes(error?.$metadata?.httpStatusCode);
 return {
  async current(key){try{const info=await store.head(key);const value=await readJson(store,key);return {bytes:Buffer.from(JSON.stringify(value)),version:info.id};}catch(error){if(missing(error))return null;throw error;}},
  async immutable(key,bytes){
   releaseKey(key);try{await client.send(new PutObjectCommand({Bucket:bucket,Key:prefix+key,Body:bytes,IfNoneMatch:'*',ContentType:key.endsWith('.json')?'application/json':'application/octet-stream'}),{abortSignal:AbortSignal.timeout(120000)});}catch(error){if(!collision(error))throw error;}
   await verifiedAsset(store,key,bytes.length,hash(bytes),new Map());
  },
  async pointer(key,bytes,version){
   releaseKey(key);await client.send(new PutObjectCommand({Bucket:bucket,Key:prefix+key,Body:bytes,ContentType:'application/json',...(version?{IfMatch:version}:{IfNoneMatch:'*'})}),{abortSignal:AbortSignal.timeout(15000)});
   await verifiedAsset(store,key,bytes.length,hash(bytes),new Map());
  }
 };
}
