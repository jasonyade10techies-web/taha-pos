import {existsSync,readdirSync,appendFileSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function installedAndroidTools(root,platform=process.platform){return ['platforms/android-35/android.jar','build-tools/35.0.0/lib/apksigner.jar',`build-tools/35.0.0/aapt${platform==='win32'?'.exe':''}`].every(file=>existsSync(path.join(root,file)));}
export function findSdkManager(root,platform=process.platform){
 const base=path.join(root,'cmdline-tools');if(!existsSync(base))throw Error('Official Android command-line tools are missing.');
 const versions=readdirSync(base,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
 for(const version of ['latest',...versions.filter(name=>name!=='latest')]){const file=path.join(base,version,'bin',platform==='win32'?'sdkmanager.bat':'sdkmanager');if(existsSync(file))return file;}
 throw Error('Cannot locate the official SDK manager, including versioned command-line tools.');
}
function main(){
 if(process.platform!=='linux')throw Error('This provisioner is for Linux CI. Windows uses scripts/build-android.ps1.');
 const root=realpathSync(process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||'/usr/local/lib/android/sdk');if(/[\r\n]/.test(root))throw Error('Invalid SDK root.');
 if(!installedAndroidTools(root))execFileSync(findSdkManager(root),['platforms;android-35','build-tools;35.0.0'],{stdio:'inherit',timeout:300000});
 if(!installedAndroidTools(root))throw Error('Required platform35/build-tools35 files are incomplete.');
 if(process.env.GITHUB_ENV)appendFileSync(process.env.GITHUB_ENV,`ANDROID_HOME=${root}\nANDROID_SDK_ROOT=${root}\n`);
 console.log('Official Android platform35 and build-tools35 verified. No PATH assumption required.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
