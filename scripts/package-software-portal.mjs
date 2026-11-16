import {readFile,mkdir,writeFile,cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QRCodeSVG} from 'qrcode.react';
import {validateRelease} from '../distribution/manifest.mjs';
import {validateWindowsRelease,verifyTauriSignature} from '../distribution/windows-manifest.mjs';
import {publishRelease} from '../distribution/handler.mjs';
import {inspectApk} from './android-release.mjs';
const [windowsFile,androidFile,outputFile,publicOrigin]=process.argv.slice(2),origin=new URL(publicOrigin);
if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password||origin.search||origin.hash)throw Error('Use the explicit approved public HTTPS origin.');
const output=path.resolve(outputFile??'');if(!output.startsWith(path.resolve('artifacts')+path.sep))throw Error('Use a new artifact directory.');await mkdir(output,{recursive:false});
const windows=validateWindowsRelease(JSON.parse(await readFile(windowsFile,'utf8'))),android=validateRelease(JSON.parse(await readFile(androidFile,'utf8'))),publicKey=(await readFile('src-tauri/updater-staging.pub','utf8')).trim();
if(windows.channel!=='staging'||android.channel!=='test')throw Error('This is an acceptance package, not a production publisher.');
for(const file of windows.files){const source=path.join(path.dirname(windowsFile),path.basename(file.url)),bytes=await readFile(source);verifyTauriSignature(bytes,file.signature,publicKey,windows.version);if(bytes.length!==file.sizeBytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Windows artifact mismatch.');const target=path.join(output,file.url.slice('/downloads/taha-pos/'.length));await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
const apk=path.join(path.dirname(androidFile),path.basename(android.apkUrl)),identity=inspectApk(apk);
if(identity.signingCertificateSha256!=='fe4bd258ec8f80aa5aeb2fcc608e7fe42c2dd0af3931767ca8bfd84af3618a38'||['applicationId','versionCode','versionName','signingCertificateSha256'].some(key=>identity[key]!==android[key]))throw Error('Android signer/identity mismatch.');
await publishRelease(output,apk,android);
for(const name of [`windows-${windows.channel}`,`windows-${windows.channel}-${windows.version}`])await writeFile(path.join(output,'releases',name+'.json'),JSON.stringify(windows,null,2)+'\n',{flag:'wx'});
await mkdir(path.join(output,'portal'));await writeFile(path.join(output,'portal/android-qr.svg'),renderToStaticMarkup(createElement(QRCodeSVG,{value:origin.origin+'/downloads/taha-staff',size:280,level:'M',marginSize:4,bgColor:'#ffffff',fgColor:'#000000'})));
for(const name of ['manifest.mjs','handler.mjs','release-store.mjs','windows-manifest.mjs','software-handler.mjs','server.mjs'])await cp(path.join('distribution',name),path.join(output,name));
await writeFile(path.join(output,'package.json'),JSON.stringify({name:'taha-software-downloads',version:windows.version,private:true,type:'module',engines:{node:'>=22.13 <23 || >=24 <25'},scripts:{start:'node server.mjs'}})+'\n');
await writeFile(path.join(output,'README.txt'),`TAHA MOBILES verified acceptance software package\nWindows ${windows.version}; Android ${android.versionName}, build ${android.versionCode}\nPUBLIC_API_URL=${origin.origin}\nPORT=<assigned port>; HOST=0.0.0.0; npm start\nThis optional standalone download package is NOT the full POS backend.\nThe full Hostinger application serves these routes from durable private software-releases/v1/ storage.\nNo live Hostinger URL is claimed by generating this package.\nWindows updater signatures are present. Authenticode publisher signing is not configured.\n`);
const entries={},manifest=[];async function walk(directory,relative=''){for(const item of await readdir(directory,{withFileTypes:true})){if(item.isSymbolicLink())throw Error('Unexpected link in portal package.');const key=relative+item.name,file=path.join(directory,item.name);if(item.isDirectory())await walk(file,key+'/');else{const bytes=await readFile(file);entries[key]=new Uint8Array(bytes);manifest.push({path:key,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}
await walk(output);const payload=Buffer.from(JSON.stringify({publicOrigin:origin.origin,windowsSource:windows.sourceCommit,androidSource:android.sourceCommit,files:manifest},null,2));await writeFile(path.join(output,'software-manifest.json'),payload);entries['software-manifest.json']=payload;
const zipped=zipSync(entries,{level:6}),zip=output+'.zip';await writeFile(zip,zipped,{flag:'wx'});const recovered=unzipSync(zipped);for(const [key,bytes]of Object.entries(entries))if(createHash('sha256').update(bytes).digest('hex')!==createHash('sha256').update(recovered[key]??Buffer.alloc(0)).digest('hex'))throw Error('Software ZIP integrity mismatch.');
console.log(JSON.stringify({output,zip,files:Object.keys(entries).length,sizeBytes:zipped.length,sha256:createHash('sha256').update(zipped).digest('hex'),publicOrigin:origin.origin,hosted:false}));
