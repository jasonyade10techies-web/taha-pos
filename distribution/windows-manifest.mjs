import {createPublicKey,createHash,verify,timingSafeEqual} from 'node:crypto';

const fail=message=>{throw Error(message);};
function fields(value,allowed){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(key=>!allowed.includes(key)))fail('Invalid software release fields.');}
function base64(value,max=16384){if(typeof value!=='string'||!value||value.length>max||!/[A-Za-z0-9]/.test(value))fail('Invalid updater signature encoding.');const bytes=Buffer.from(value,'base64');if(bytes.toString('base64')!==value)fail('Invalid updater signature encoding.');return bytes;}
export function verifyTauriSignature(bytes,encodedSignature,encodedKey,version){
 const publicLines=base64(encodedKey).toString('utf8').trimEnd().split(/\r?\n/),signatureLines=base64(encodedSignature).toString('utf8').trimEnd().split(/\r?\n/);
 if(publicLines.length!==2||signatureLines.length!==4||!publicLines[0].startsWith('untrusted comment:')||!signatureLines[0].startsWith('untrusted comment:')||!signatureLines[2].startsWith('trusted comment: '))fail('Invalid updater signature structure.');
 const key=base64(publicLines[1]),signature=base64(signatureLines[1]),globalSignature=base64(signatureLines[3]);
 if(key.length!==42||signature.length!==74||globalSignature.length!==64||key.subarray(0,2).toString()!=='Ed'||!['Ed','ED'].includes(signature.subarray(0,2).toString())||!timingSafeEqual(key.subarray(2,10),signature.subarray(2,10)))fail('Updater signing identity mismatch.');
 const publicKey=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),key.subarray(10)]),type:'spki',format:'der'});
 const message=signature.subarray(0,2).toString()==='ED'?createHash('blake2b512').update(bytes).digest():bytes;
 const signed=signature.subarray(10),comment=signatureLines[2].slice('trusted comment: '.length);
 if(!verify(null,message,publicKey,signed)||!verify(null,Buffer.concat([signed,Buffer.from(comment)]),publicKey,globalSignature))fail('Updater signature verification failed.');
 const versions=comment.split('\t').filter(field=>field.startsWith('version:'));
 if(versions.length!==1||versions[0].slice(8)!==version)fail('Updater signature does not authenticate this version.');
 return true;
}
export function validateWindowsRelease(value){
 fields(value,['schemaVersion','platform','channel','applicationId','version','releasedAt','releaseNotes','files','sourceCommit']);
 if(value.schemaVersion!==1||value.platform!=='windows-x86_64'||!['staging','stable'].includes(value.channel))fail('Invalid Windows release channel/platform.');
 if(value.applicationId!==(value.channel==='staging'?'com.tahamobiles.pos.staging':'com.tahamobiles.pos'))fail('Windows application identity does not match channel.');
 if(typeof value.version!=='string'||!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value.version))fail('Invalid Windows version.');
 const [major,minor,patch]=value.version.split('.').map(Number);if(major>255||minor>255||patch>65535)fail('Windows installer version exceeds supported bounds.');
 if(typeof value.releasedAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(value.releasedAt)||!Number.isFinite(Date.parse(value.releasedAt)))fail('Invalid Windows release time.');
 if(!Array.isArray(value.releaseNotes)||value.releaseNotes.length>16||value.releaseNotes.some(note=>typeof note!=='string'||note.length>500))fail('Invalid release notes.');
 if(value.sourceCommit!==undefined&&!/^[0-9a-f]{40}$/.test(value.sourceCommit))fail('Invalid source provenance.');
 if(!Array.isArray(value.files)||value.files.length<1||value.files.length>2)fail('Invalid Windows release files.');
 const seen=new Set(),prefix=`/downloads/taha-pos/windows/${value.channel}/${value.version}/`;
 for(const file of value.files){
  fields(file,['type','url','sizeBytes','sha256','signature']);
  if(!['nsis','msi'].includes(file.type)||seen.has(file.type))fail('Duplicate or invalid Windows installer type.');seen.add(file.type);
  if(typeof file.url!=='string'||!file.url.startsWith(prefix)||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,139}\.(exe|msi)$/.test(file.url.slice(prefix.length))||!file.url.endsWith(file.type==='nsis'?'.exe':'.msi'))fail('Invalid versioned Windows artifact path.');
  if(!Number.isSafeInteger(file.sizeBytes)||file.sizeBytes<1||file.sizeBytes>512*1024*1024||typeof file.sha256!=='string'||!/^[0-9a-f]{64}$/.test(file.sha256))fail('Invalid Windows artifact size/hash.');
  base64(file.signature);
 }
 return value;
}
export function tauriUpdateManifest(input,origin){
 const value=validateWindowsRelease(input),url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)fail('An explicit HTTPS public download origin is required.');
 const file=value.files.find(file=>file.type==='nsis')??value.files[0];
 return {version:value.version,notes:value.releaseNotes.join('\n'),pub_date:value.releasedAt,platforms:{'windows-x86_64':{signature:file.signature,url:url.origin+file.url,sizeBytes:file.sizeBytes,sha256:file.sha256}}};
}
