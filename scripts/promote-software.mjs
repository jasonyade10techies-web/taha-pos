import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {promoteSoftware} from '../distribution/promotion.mjs';
import {s3ReleaseWriter} from '../distribution/s3-writer.mjs';
import {inspectApk} from './android-release.mjs';
if(process.env.TAHA_SOFTWARE_PUBLISH_APPROVED!=='staging')throw Error('Explicit staging software promotion approval is required.');
const input=path.resolve(process.argv[2]??'');if(!input.startsWith(path.resolve('artifacts')+path.sep))throw Error('Promote an inspected versioned artifact manifest.');
const release=JSON.parse(await readFile(input,'utf8'));
if(release.channel!== (release.platform==='windows-x86_64'?'staging':'test'))throw Error('This command cannot publish production releases.');
const require=createRequire(path.resolve('server/package.json')),{S3Client,HeadObjectCommand,GetObjectCommand,PutObjectCommand}=require('@aws-sdk/client-s3');
const endpoint=new URL(process.env.S3_ENDPOINT??'');if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash)throw Error('Configure the approved HTTPS storage origin privately.');
for(const key of ['S3_BUCKET','S3_REGION','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY'])if(!process.env[key])throw Error('Private software storage configuration is incomplete.');
const client=new S3Client({endpoint:endpoint.origin,region:process.env.S3_REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});
try{
 const assets=new Map(),base=path.dirname(input),windows=release.platform==='windows-x86_64';
 for(const file of windows?release.files:[{url:release.apkUrl}]){const name=path.basename(file.url),key=file.url.slice((windows?'/downloads/taha-pos/':'/downloads/taha-staff/').length);assets.set(key,await readFile(path.join(base,name)));}
 const publicKey=(await readFile('src-tauri/updater-staging.pub','utf8')).trim();
 const result=await promoteSoftware({release,assets,publicKey,writer:s3ReleaseWriter({client,bucket:process.env.S3_BUCKET,prefix:'software-releases/v1/',HeadObjectCommand,GetObjectCommand,PutObjectCommand}),verifyAndroid:async(_bytes,value)=>{
  const verified=inspectApk(path.join(base,path.basename(value.apkUrl)));
  if(verified.signingCertificateSha256!=='fe4bd258ec8f80aa5aeb2fcc608e7fe42c2dd0af3931767ca8bfd84af3618a38'||['applicationId','versionCode','versionName','signingCertificateSha256'].some(key=>verified[key]!==value[key]))throw Error('Android signing continuity or metadata validation failed.');
 }});
 console.log(JSON.stringify({status:'verified',channel:release.channel,...result}));
}catch{console.error('Software promotion failed. The previous release pointer is retained unless the final conditional update was already acknowledged. Inspect private diagnostics; credentials are not printed.');process.exitCode=1;}finally{client.destroy();}
