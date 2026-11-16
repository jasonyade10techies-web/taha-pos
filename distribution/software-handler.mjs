import {pipeline} from 'node:stream/promises';
import {createDownloadHandler,androidAvailable} from './handler.mjs';
import {localReleaseStore,readJson,verifiedAsset} from './release-store.mjs';
import {validateWindowsRelease,tauriUpdateManifest} from './windows-manifest.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createSoftwareHandler(root,{publicOrigin}={}){
 const store=typeof root==='string'?localReleaseStore(root):root,android=createDownloadHandler(store),cache=new Map();
 const available=async channel=>{
  const release=validateWindowsRelease(await readJson(store,`releases/windows-${channel}.json`));if(release.channel!==channel)throw Error('Wrong Windows channel.');
  for(const file of release.files)await verifiedAsset(store,file.url.slice('/downloads/taha-pos/'.length),file.sizeBytes,file.sha256,cache);
  return release;
 };
 return async(req,res)=>{
  let url;try{url=new URL(req.url,'http://local.invalid');}catch{return false;}
  if(url.pathname!=='/downloads'&&!url.pathname.startsWith('/downloads/'))return false;
  if(await android(req,res))return true;
  const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:body);};
  if(!['GET','HEAD'].includes(req.method)){send(405,'{"message":"Read only."}');return true;}
  try{
   if(['/downloads','/downloads/'].includes(url.pathname)){
    const cards=[];
    for(const channel of ['stable','staging']){try{const release=await available(channel);cards.push(`<section><h2>Windows · ${escape(channel)} · ${release.version}</h2><p>Windows 10/11 x64 · Bundled interface and local SQLite</p>${release.files.map(f=>`<p><a href="${f.url}">Download ${f.type==='nsis'?'EXE installer':'MSI installer'}</a> · ${(f.sizeBytes/1048576).toFixed(1)} MB<br><small>SHA256 ${f.sha256}<br><a href="${f.url}.sig">Updater signature</a></small></p>`).join('')}<ul>${release.releaseNotes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul></section>`);}catch{cards.push(`<section><h2>Windows · ${channel}</h2><p>No verified release is available on this channel.</p></section>`);}}
    for(const channel of ['stable','test']){try{const release=await androidAvailable(store,channel,cache);cards.push(`<section><h2>Android · ${channel} · ${escape(release.versionName)}</h2><p>Build ${release.versionCode} · Android 8.0 or later</p><a href="${release.apkUrl}">Download Taha Staff APK</a><ul>${release.releaseNotes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul><small>SHA256 ${release.sha256}</small></section>`);}catch{cards.push(`<section><h2>Android · ${channel}</h2><p>No verified release is available on this channel.</p></section>`);}}
    let qr='';try{const info=await store.head('portal/android-qr.svg');if(info.size>0&&info.size<32768)qr='<p><img src="/downloads/android-qr.svg" width="260" height="260" alt="Scan to download Taha Staff"><br>Scan with your phone to open Android downloads.</p>';}catch{/* Optional QR is omitted until its verified public origin is configured. */}
    send(200,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Taha Mobiles — Software Downloads</title><style>body{font:16px system-ui;color:#171717;background:#f4f4f4;margin:0;padding:32px 20px}main{max-width:880px;margin:auto}header{border-left:6px solid #e52c39;padding-left:20px}section{background:white;padding:24px;border:1px solid #ddd;border-radius:12px;margin:20px 0}a{color:#171717;display:inline-block;padding:10px;background:#ffca26;border-radius:6px;text-decoration:none}small{overflow-wrap:anywhere;color:#555}li{margin:8px 0}</style><main><header><strong>TAHA MOBILES</strong><h1>Taha POS &amp; Taha Staff</h1><p>Approved application releases. Business records are available only after secure sign-in.</p></header>${cards.join('')}${qr}<section><h2>Installation</h2><p>Windows: run the EXE or MSI installer as your Windows user. Android: allow installation from your browser and install over the compatible existing app. Keep application data; do not uninstall to update.</p><p>Test and staging channels are for acceptance testing. Updater signatures verify application releases; a Windows publisher certificate is a separate release requirement. Configure your approved shop connection after installation.</p><a href="/login">Open web POS</a></section></main></html>`,'text/html; charset=utf-8');return true;
   }
   if(url.pathname==='/downloads/android-qr.svg'){
    const info=await store.head('portal/android-qr.svg');if(info.size>32768)throw Error('Invalid QR asset.');const chunks=[];let length=0;for await(const chunk of await store.stream('portal/android-qr.svg',info)){length+=chunk.length;if(length>32768)throw Error('Invalid QR asset.');chunks.push(Buffer.from(chunk));}send(200,Buffer.concat(chunks),'image/svg+xml');return true;
   }
   const update=/^\/downloads\/taha-pos\/updates\/(stable|staging)\.json$/.exec(url.pathname);
   if(update){send(200,JSON.stringify(tauriUpdateManifest(await available(update[1]),publicOrigin)));return true;}
   const current=/^\/downloads\/taha-pos\/releases\/(stable|staging)\.json$/.exec(url.pathname);
   if(current){send(200,JSON.stringify(await available(current[1])));return true;}
   const file=/^\/downloads\/taha-pos\/windows\/(stable|staging)\/(\d+\.\d+\.\d+)\/([A-Za-z0-9][A-Za-z0-9._-]{0,139}\.(?:exe|msi))(\.sig)?$/.exec(url.pathname);
   if(file){
    const release=validateWindowsRelease(await readJson(store,`releases/windows-${file[1]}-${file[2]}.json`));
    const artifact=release.files.find(item=>item.url===url.pathname.replace(/\.sig$/,''));if(!artifact||release.channel!==file[1]||release.version!==file[2])throw Error('Unknown artifact.');
    const key=artifact.url.slice('/downloads/taha-pos/'.length),info=await verifiedAsset(store,key,artifact.sizeBytes,artifact.sha256,cache);
    if(file[4])send(200,artifact.signature+'\n','text/plain');
    else{res.writeHead(200,{'Content-Type':artifact.type==='nsis'?'application/vnd.microsoft.portable-executable':'application/x-msi','Content-Length':artifact.sizeBytes,'Content-Disposition':`attachment; filename="${file[3]}"`,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else await pipeline(await store.stream(key,info),res);}return true;
   }
  }catch{if(res.headersSent){res.destroy();return true;}}
  send(404,'{"message":"This verified release is unavailable."}');return true;
 };
}
