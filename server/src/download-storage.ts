import path from 'node:path';
import {createRequire} from 'node:module';
import {Readable} from 'node:stream';
import {S3Client,HeadObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import type {Configuration} from './config';
export interface ReleaseStore {
 head(key:string):Promise<{size:number;id:string}>;
 stream(key:string,version:{size:number;id:string}):Promise<Readable>;
}
export function downloadStorage(config:Configuration):{store:ReleaseStore;close:()=>void}{
 const load=createRequire(__filename);
 if(config.cloud){
  if(config.storageDriver!=='s3'||!config.s3Bucket||!config.s3AccessKey||!config.s3SecretKey)throw Error('Cloud software releases require durable private storage.');
  const client=new S3Client({region:config.s3Region,endpoint:config.s3Endpoint,forcePathStyle:Boolean(config.s3Endpoint),credentials:{accessKeyId:config.s3AccessKey,secretAccessKey:config.s3SecretKey}});
  const module=load(path.resolve(__dirname,'../distribution/s3-store.mjs')) as {s3ReleaseStore:(options:object)=>ReleaseStore};
  return {store:module.s3ReleaseStore({client,bucket:config.s3Bucket,prefix:'software-releases/v1/',HeadObjectCommand,GetObjectCommand}),close:()=>client.destroy()};
 }
 const module=load(path.resolve(__dirname,'../distribution/release-store.mjs')) as {localReleaseStore:(root:string)=>ReleaseStore};
 return {store:module.localReleaseStore(process.env.TAHA_RELEASE_ROOT??path.resolve(__dirname,'../software-releases')),close:()=>{}};
}
