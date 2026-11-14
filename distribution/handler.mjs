import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,mkdir,rename,unlink,stat,realpath,open} from 'node:fs/promises';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {validateRelease} from './manifest.mjs';
const prefix='/downloads/taha-staff';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function atomic(file,bytes){await mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+randomUUID()+'.tmp';try{const handle=await open(temporary,'wx');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}}
export async function publishRelease(root,input,manifest){
 const release=validateRelease(manifest),bytes=await readFile(input);if(bytes.length!==release.sizeBytes||digest(bytes)!==release.sha256)throw Error('APK byte verification failed.');
 await mkdir(root,{recursive:true});const lock=path.join(root,'.publish-lock');await mkdir(lock);
 try{
  const file=path.join(root,release.apkUrl.slice(prefix.length+1));const historical=path.join(root,`releases/${release.channel}-${release.versionCode}.json`);
  let prior;try{prior=JSON.parse(await readFile(historical,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(prior&&JSON.stringify(prior)!==JSON.stringify(release))throw Error('An immutable release already exists with different metadata.');
  let existing;try{existing=await readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing&&(existing.length!==bytes.length||digest(existing)!==release.sha256))throw Error('Immutable APK collision.');
  if(!existing)await atomic(file,bytes);
  if(!prior)await atomic(historical,JSON.stringify(release,null,2)+'\n');
  // Current metadata is published last. Older APKs and their manifests are retained.
  await atomic(path.join(root,`releases/${release.channel}.json`),JSON.stringify(release,null,2)+'\n');
  return file;
 }finally{await import('node:fs/promises').then(fs=>fs.rmdir(lock));}
}
async function safeFile(root,relative){const base=await realpath(root),file=await realpath(path.join(base,relative));if(!file.startsWith(base+path.sep))throw Error('Unsafe file.');const info=await stat(file);if(!info.isFile())throw Error('Not a file.');return {file,info};}
export function createDownloadHandler(root){
 const verified=new Map();
 const available=async channel=>{
  const {file,info}=await safeFile(root,`releases/${channel}.json`);if(info.size>32768)throw Error('Manifest too large.');const release=validateRelease(JSON.parse(await readFile(file,'utf8')));if(release.channel!==channel)throw Error('Wrong channel.');
  const apk=await safeFile(root,release.apkUrl.slice(prefix.length+1));if(apk.info.size!==release.sizeBytes)throw Error('Missing release bytes.');
  const key=apk.file+':'+apk.info.mtimeMs+':'+apk.info.size;if(verified.get(key)!==release.sha256){if(digest(await readFile(apk.file))!==release.sha256)throw Error('Bad release bytes.');verified.set(key,release.sha256);}
  return release;
 };
 return async function handle(request,response){
  let url;try{url=new URL(request.url,'http://local.invalid');}catch{return false;}
  if(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/'))return false;
  const send=(code,body,type='application/json')=>{response.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});response.end(request.method==='HEAD'?undefined:body);};
  if(!['GET','HEAD'].includes(request.method)){send(405,'{"message":"Read only."}');return true;}
  try{
   if(url.pathname===prefix+'/status'){
    const channel=url.searchParams.get('channel')??'test';if(!['test','stable'].includes(channel))throw Error('Unknown channel.');
    let release=null;try{release=await available(channel);}catch{/* An optional channel is not an application failure. */}
    send(200,JSON.stringify({available:!!release,channel,...(release?{release}:{})}));return true;
   }
   if(url.pathname===prefix||url.pathname===prefix+'/'){
    const cards=[];for(const channel of ['test','stable']){try{const r=await available(channel);cards.push(`<section><h2>${channel==='test'?'Test build':'Stable build'} · ${escape(r.versionName)}</h2><p>Build ${r.versionCode} · ${(r.sizeBytes/1048576).toFixed(1)} MB · ${r.minAndroidApi===26?'Android 8.0 or later':`Android API level ${r.minAndroidApi} or later`}</p><a href="${r.apkUrl}">Download Taha Staff APK</a><ul>${r.releaseNotes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul><small>SHA256: ${r.sha256}</small></section>`);}catch{cards.push(`<section><h2>${channel==='test'?'Test':'Stable'}</h2><p>No verified release is available on this channel.</p></section>`);}}
    send(200,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Taha Staff — Downloads</title><style>body{font:16px system-ui;background:#f3f3f3;color:#171717;margin:0;padding:32px 20px}main{max-width:720px;margin:auto}header{border-left:6px solid #e52c39;padding-left:18px}section{background:white;border:1px solid #ddd;border-radius:14px;padding:24px;margin:20px 0}a{display:inline-block;background:#ffca26;color:#171717;text-decoration:none;border-radius:8px;padding:14px 20px;font-weight:700}small{overflow-wrap:anywhere;color:#555}li{margin:8px 0}</style><main><header><strong>TAHA MOBILES</strong><h1>Taha Staff</h1><p>The staff app for your shop. Install the approved channel, then connect to your shop.</p></header>${cards.join('')}<p>Updates require Android confirmation. Keep the installed app; install over it to retain compatible data. Never uninstall to update. This download page does not contain shop records.</p></main></html>`,'text/html; charset=utf-8');return true;
   }
   const channel=/^\/downloads\/taha-staff\/releases\/(test|stable)\.json$/.exec(url.pathname)?.[1];
   if(channel){send(200,JSON.stringify(await available(channel)));return true;}
   if(url.pathname===prefix+'/latest.apk'){
    const selected=url.searchParams.get('channel')??'test';if(!['test','stable'].includes(selected))throw Error('Unknown channel.');const release=await available(selected);response.writeHead(302,{'Location':release.apkUrl,'Cache-Control':'no-store'});response.end();return true;
   }
   const match=/^\/downloads\/taha-staff\/apks\/(test|stable)\/([1-9][0-9]*)\/([A-Za-z0-9][A-Za-z0-9._-]{0,139}\.apk)$/.exec(url.pathname);
   if(match){
    const historical=await safeFile(root,`releases/${match[1]}-${match[2]}.json`);if(historical.info.size>32768)throw Error('Invalid history.');const release=validateRelease(JSON.parse(await readFile(historical.file,'utf8')));if(release.apkUrl!==url.pathname)throw Error('Unknown APK.');
    const apk=await safeFile(root,url.pathname.slice(prefix.length+1));if(apk.info.size!==release.sizeBytes)throw Error('Incomplete APK.');const key=apk.file+':'+apk.info.mtimeMs+':'+apk.info.size;if(verified.get(key)!==release.sha256){if(digest(await readFile(apk.file))!==release.sha256)throw Error('Corrupt APK.');verified.set(key,release.sha256);}
    response.writeHead(200,{'Content-Type':'application/vnd.android.package-archive','Content-Length':release.sizeBytes,'Content-Disposition':`attachment; filename="${match[3]}"`,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});
    if(request.method==='HEAD')response.end();else await pipeline(createReadStream(apk.file),response);return true;
   }
  }catch{if(response.headersSent){response.destroy();return true;}}
  send(404,'{"message":"This verified release is not available."}');return true;
 };
}
