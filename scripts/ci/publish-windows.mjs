import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {validateWindowsRelease} from '../../distribution/windows-manifest.mjs';
import {findDraftRelease,assertAssetBytes} from './release-policy.mjs';
const root='artifacts/windows-release',release=validateWindowsRelease(JSON.parse(readFileSync(root+'/release.json','utf8'))),repository=process.env.GITHUB_REPOSITORY;
if(repository!=='jasonyade10techies-web/taha-pos'||release.sourceCommit!==process.env.GITHUB_SHA)throw Error('Wrong release source/destination.');
const tag='windows-staging-v'+release.version,notes=path.join(process.env.RUNNER_TEMP,'windows-notes.txt');writeFileSync(notes,release.releaseNotes.join('\n'));
const files=readdirSync(root).filter(name=>name==='release.json'||name==='sha256.txt'||/^Taha-POS-Staging-[0-9.]+-x64(?:-setup\.exe|\.msi)(?:\.sig)?$/.test(name)).map(name=>path.join(root,name));
const gh=args=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
gh(['release','create',tag,'--repo',repository,'--target',process.env.GITHUB_SHA,'--draft','--prerelease','--title','Taha POS Windows Staging '+release.version,'--notes-file',notes,...files]);
const draft=findDraftRelease(JSON.parse(gh(['api',`repos/${repository}/releases?per_page=100`])),tag);
for(const file of files){const expected=readFileSync(file),asset=draft.assets.find(item=>item.name===path.basename(file));if(!asset)throw Error('Uploaded native artifact missing; release remains a draft.');const actual=execFileSync('gh',['api',`repos/${repository}/releases/assets/${asset.id}`,'-H','Accept: application/octet-stream'],{maxBuffer:256*1024*1024});assertAssetBytes(actual,{size:expected.length,sha256:createHash('sha256').update(expected).digest('hex')});}
gh(['release','edit',tag,'--repo',repository,'--draft=false','--prerelease']);console.log('Exact Windows staging files archived in a verified private GitHub prerelease.');
