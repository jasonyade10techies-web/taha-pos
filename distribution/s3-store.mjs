import {releaseKey} from './release-store.mjs';
// Dependency injection keeps this shared module runnable in the standalone
// portal, NestJS package and isolated tests without a second SDK installation.
export function s3ReleaseStore({client,bucket,prefix='software-releases/v1/',HeadObjectCommand,GetObjectCommand}){
 if(!bucket||prefix!=='software-releases/v1/')throw Error('Software releases require their dedicated storage prefix.');
 const object=key=>({Bucket:bucket,Key:prefix+releaseKey(key)});
 return {
  async head(key){const value=await client.send(new HeadObjectCommand(object(key)),{abortSignal:AbortSignal.timeout(12000)});if(!Number.isSafeInteger(value.ContentLength)||!value.ETag)throw Error('Incomplete software object.');return {size:value.ContentLength,id:value.ETag};},
  async stream(key,version){
   const abort=AbortSignal.timeout(120000),value=await client.send(new GetObjectCommand({...object(key),IfMatch:version.id}),{abortSignal:abort});
   if(!value.Body||value.ETag!==version.id||value.ContentLength!==version.size){value.Body?.destroy?.();throw Error('Software object changed.');}
   const body=value.Body,cancel=()=>body.destroy?.(Error('Software download timed out.'));abort.addEventListener('abort',cancel,{once:true});
   body.once?.('close',()=>abort.removeEventListener('abort',cancel));return body;
  }
 };
}
