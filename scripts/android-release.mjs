import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';
import {publishRelease} from '../distribution/handler.mjs';
import {validateRelease} from '../distribution/manifest.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=(flag,fallback)=>{const i=process.argv.indexOf(flag);if(i<0)return fallback;if(!process.argv[i+1])throw Error('Missing '+flag);return process.argv[i+1];};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function inspectApk(file){
 const sdk=process.env.ANDROID_HOME||path.join(root,'.tools/android/sdk'),tools=path.join(sdk,'build-tools/35.0.0');
 const java=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
 const info=execFileSync(path.join(tools,process.platform==='win32'?'aapt.exe':'aapt'),['dump','badging',file],{encoding:'utf8',windowsHide:true});
 const pkg=/package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'/.exec(info),api=/sdkVersion:'([0-9]+)'/.exec(info);
 const signature=execFileSync(java,['-jar',path.join(tools,'lib/apksigner.jar'),'verify','--print-certs',file],{encoding:'utf8',windowsHide:true});
 const certificates=[...signature.matchAll(/Signer #[0-9]+ certificate SHA-256 digest: ([a-fA-F0-9]{64})/g)].map(m=>m[1].toLowerCase());
 if(!pkg||!api||certificates.length!==1)throw Error('Cannot verify APK identity and exactly one signer.');
 return {applicationId:pkg[1],versionCode:Number(pkg[2]),versionName:pkg[3],minAndroidApi:Number(api[1]),signingCertificateSha256:certificates[0]};
}
export async function packageDownloads(output,channel,versionCode){
 const entries={};async function walk(directory,relative=''){for(const entry of await readdir(directory,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('Links are not deployable.');const name=relative+entry.name;if(entry.isDirectory()){if(!/^(?:releases|apks(?:\/(?:test|stable)(?:\/[1-9][0-9]*)?)?)$/.test(name))throw Error('Unexpected directory in download package.');await walk(path.join(directory,entry.name),name+'/');}else {
  if(['artifact-manifest.json','release.json','sha256.txt'].includes(name)||/^Taha-Staff-downloads-(test|stable)-[0-9]+\.zip$/.test(name)||/^Taha-Staff-(test|stable)-build[0-9]+\.apk$/.test(name))continue;
  if(!['manifest.mjs','handler.mjs','server.mjs','package.json'].includes(name)&&!/^releases\/(?:test|stable)(?:-[1-9][0-9]*)?\.json$/.test(name)&&!/^apks\/(?:test|stable)\/[1-9][0-9]*\/[A-Za-z0-9][A-Za-z0-9._-]{0,139}\.apk$/.test(name))throw Error('Unexpected/private file in download package.');
  const bytes=await readFile(path.join(directory,entry.name));if(name.startsWith('releases/')){const release=validateRelease(JSON.parse(bytes.toString('utf8'))),apk=await readFile(path.join(output,release.apkUrl.slice('/downloads/taha-staff/'.length)));if(apk.length!==release.sizeBytes||hash(apk)!==release.sha256)throw Error('Unverified APK in download package.');}entries[name]=new Uint8Array(bytes);
 }}}
 // Only generated download runtime and approved release data enter the archive.
 for(const name of ['manifest.mjs','handler.mjs','server.mjs'])await cp(path.join(root,'distribution',name),path.join(output,name));
 await writeFile(path.join(output,'package.json'),JSON.stringify({name:'taha-staff-downloads',private:true,version:'1.0.0',type:'module',engines:{node:'>=22.13 <23 || >=24 <25'},scripts:{start:'node server.mjs',build:'node --check server.mjs'}})+'\n');
 await walk(output);const zip=zipSync(entries,{level:6}),name=`Taha-Staff-downloads-${channel}-${versionCode}.zip`,target=path.join(output,name);await writeFile(target,zip);
 const extracted=unzipSync(new Uint8Array(await readFile(target)));for(const [name,bytes] of Object.entries(entries))if(hash(bytes)!==hash(extracted[name]??new Uint8Array()))throw Error('ZIP verification failed.');return target;
}
async function main(){
 const apk=path.resolve(arg('--apk','')),output=path.resolve(arg('--output','artifacts/android-release')),channel=arg('--channel','test');
 if(!process.argv.includes('--allow-dirty-dev')&&execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit verified source first, or explicitly use --allow-dirty-dev for a nonpublished development package.');
 const identity=inspectApk(apk),bytes=await readFile(apk),filename=`Taha-Staff-${channel}-build${identity.versionCode}.apk`;
 const previousManifest=arg('--previous-manifest'),previousApk=arg('--previous-apk');
 if(previousManifest){const previous=validateRelease(JSON.parse(await readFile(previousManifest,'utf8')));if(previous.applicationId!==identity.applicationId||previous.signingCertificateSha256!==identity.signingCertificateSha256||previous.versionCode>=identity.versionCode)throw Error('Signing continuity or version increment failed.');if(previousApk)await publishRelease(output,path.resolve(previousApk),previous);}
 else if(channel==='test'){const previous={applicationId:'com.tahamobiles.staff.debug',signingCertificateSha256:'fe4bd258ec8f80aa5aeb2fcc608e7fe42c2dd0af3931767ca8bfd84af3618a38'};if(previous.signingCertificateSha256!==identity.signingCertificateSha256||previous.applicationId!==identity.applicationId||identity.versionCode<=11)throw Error('Existing test signing continuity failed.');}
 const notes=arg('--notes');if(!notes)throw Error('Release notes file required.');
 const release=validateRelease({schemaVersion:1,channel,...identity,apkUrl:`/downloads/taha-staff/apks/${channel}/${identity.versionCode}/${filename}`,sizeBytes:bytes.length,sha256:hash(bytes),releasedAt:new Date().toISOString(),minBackendApiVersion:1,required:false,releaseNotes:(await readFile(notes,'utf8')).split(/\r?\n/).filter(Boolean),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()});
 await mkdir(output,{recursive:true});await publishRelease(output,apk,release);await cp(apk,path.join(output,filename));await writeFile(path.join(output,'release.json'),JSON.stringify(release,null,2)+'\n');await writeFile(path.join(output,'sha256.txt'),`${release.sha256}  ${filename}\n`);
 const archive=await packageDownloads(output,channel,identity.versionCode);const result={apk:path.join(output,filename),manifest:path.join(output,'release.json'),checksum:path.join(output,'sha256.txt'),package:archive,versionCode:identity.versionCode,channel};await writeFile(path.join(output,'artifact-manifest.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
