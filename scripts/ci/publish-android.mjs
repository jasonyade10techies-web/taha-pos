import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {assertAssetBytes} from './release-policy.mjs';
const result=JSON.parse(readFileSync('artifacts/android-release/artifact-manifest.json','utf8'));
const tag=`android-test-v${result.versionCode}`,repository=process.env.GITHUB_REPOSITORY;
if(repository!=='jasonyade10techies-web/taha-pos')throw Error('Wrong release destination.');
const run=args=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const files=[result.apk,result.manifest,result.checksum,result.package];
run(['release','create',tag,'--repo',repository,'--target',process.env.GITHUB_SHA,'--draft','--prerelease','--title',`Taha Staff Test build ${result.versionCode}`,'--notes-file','docs/r3a/ANDROID_RELEASE_NOTES.txt',...files]);
const release=JSON.parse(run(['api',`repos/${repository}/releases/tags/${tag}`]));
for(const file of files){const bytes=readFileSync(file),asset=release.assets.find(a=>a.name===path.basename(file));if(!asset)throw Error('Uploaded asset missing; release remains draft.');const actual=execFileSync('gh',['api',`repos/${repository}/releases/assets/${asset.id}`,'-H','Accept: application/octet-stream'],{maxBuffer:80*1024*1024});const {createHash}=await import('node:crypto');assertAssetBytes(actual,{size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
run(['release','edit',tag,'--repo',repository,'--draft=false','--prerelease']);console.log('Verified private test prerelease published. Owner deploys the download ZIP manually.');
