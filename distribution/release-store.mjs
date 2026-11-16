import {realpath,stat,open} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function releaseKey(key){
 if(typeof key!=='string'||!key||key.length>600||key.split('/').some(part=>!part||part==='.'||part==='..'||!/^[A-Za-z0-9._-]+$/.test(part)))throw Error('Invalid software release key.');
 return key;
}
export function localReleaseStore(root){
 const file=async key=>{releaseKey(key);const base=await realpath(root),target=await realpath(path.join(base,key));if(!target.startsWith(base+path.sep))throw Error('Unsafe software path.');return target;};
 const identity=info=>`${info.dev}:${info.ino}:${info.mtimeMs}:${info.ctimeMs}:${info.size}`;
 return {
  async head(key){const target=await file(key),info=await stat(target);if(!info.isFile())throw Error('Missing software file.');return {size:info.size,id:identity(info)};},
  async stream(key,version){const handle=await open(await file(key),'r');try{if(identity(await handle.stat())!==version.id)throw Error('Software file changed.');return handle.createReadStream({autoClose:true});}catch(error){await handle.close();throw error;}}
 };
}
export async function readJson(store,key){
 const info=await store.head(key);if(info.size>32768)throw Error('Software manifest exceeds its size limit.');
 const stream=await store.stream(key,info),chunks=[];let length=0;try{for await(const chunk of stream){length+=chunk.length;if(length>32768)throw Error('Software manifest exceeds its size limit.');chunks.push(Buffer.from(chunk));}}finally{stream.destroy?.();}
 if(length!==info.size)throw Error('Software manifest changed.');return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function verifiedAsset(store,key,size,sha,cache){
 const info=await store.head(key);if(info.size!==size)throw Error('Release artifact size does not match.');
 const identity=`${key}:${info.id}:${size}:${sha}`;
 if(!cache.has(identity)){
  const stream=await store.stream(key,info),hash=createHash('sha256');let length=0;
  try{for await(const chunk of stream){length+=chunk.length;if(length>size)throw Error('Release artifact exceeded its size.');hash.update(chunk);}}finally{stream.destroy?.();}
  if(length!==size||hash.digest('hex')!==sha)throw Error('Release artifact checksum does not match.');
  if(cache.size>=128)cache.clear();cache.set(identity,true);
 }
 return info;
}
