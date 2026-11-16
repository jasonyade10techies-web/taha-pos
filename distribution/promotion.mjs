import {createHash} from 'node:crypto';
import {validateWindowsRelease,verifyTauriSignature} from './windows-manifest.mjs';
import {validateRelease} from './manifest.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function promoteSoftware({release,assets,writer,publicKey,verifyAndroid}){
 let pointer,history,files;
 if(release.platform==='windows-x86_64'){
  validateWindowsRelease(release);pointer=`releases/windows-${release.channel}.json`;history=`releases/windows-${release.channel}-${release.version}.json`;
  files=release.files.map(file=>({key:file.url.slice('/downloads/taha-pos/'.length),...file}));
 }else{validateRelease(release);pointer=`releases/${release.channel}.json`;history=`releases/${release.channel}-${release.versionCode}.json`;files=[{key:release.apkUrl.slice('/downloads/taha-staff/'.length),sizeBytes:release.sizeBytes,sha256:release.sha256}];}
 // Authenticate every executable before any cloud write. Caller must use the
 // approved Android verifier (apksigner + pinned channel certificate), not UI metadata.
 for(const file of files){const bytes=assets.get(file.key);if(!Buffer.isBuffer(bytes)||bytes.length!==file.sizeBytes||hash(bytes)!==file.sha256)throw Error('Unverified release artifact.');if(release.platform==='windows-x86_64')verifyTauriSignature(bytes,file.signature,publicKey,release.version);else{if(!verifyAndroid)throw Error('Android signature verifier is required.');await verifyAndroid(bytes,release);}}
 const previous=await writer.current(pointer);
 if(previous){const value=JSON.parse(previous.bytes.toString('utf8'));
  if(release.platform==='windows-x86_64'){validateWindowsRelease(value);const a=value.version.split('.').map(Number),b=release.version.split('.').map(Number);let comparison=0;for(let i=0;i<3&&!comparison;i++)comparison=Math.sign(b[i]-a[i]);if(comparison<0)throw Error('Release downgrade requires a separate approved rollback.');}
  else if(validateRelease(value).versionCode>release.versionCode)throw Error('Android release downgrade is prohibited.');
 }
 const metadata=Buffer.from(JSON.stringify(release,null,2)+'\n');
 for(const file of files)await writer.immutable(file.key,assets.get(file.key));
 await writer.immutable(history,metadata);
 // A conditional pointer update prevents another publisher silently losing a
 // release. Immutable readback is required by writer before the pointer moves.
 await writer.pointer(pointer,metadata,previous?.version);
 return {pointer,history,files:files.length};
}
