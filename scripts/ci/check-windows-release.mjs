import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {assertReleaseContext,assertSigningEnvironment} from './release-policy.mjs';
const api=route=>JSON.parse(execFileSync('gh',['api',route],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const repo=api(`repos/${process.env.GITHUB_REPOSITORY}`);
assertReleaseContext({eventName:process.env.GITHUB_EVENT_NAME,repository:repo.full_name,private:repo.private,ref:process.env.GITHUB_REF});
if(process.env.TAHA_APPROVED_COMMIT!==process.env.GITHUB_SHA)throw Error('Approve the exact complete source commit being released.');
assertSigningEnvironment(api(`repos/${repo.full_name}/environments/windows-staging-release`),api(`repos/${repo.full_name}/environments/windows-staging-release/deployment-branch-policies`),process.env.GITHUB_REF_NAME);
const version=JSON.parse(readFileSync('src-tauri/tauri.conf.json','utf8')).version,releases=api(`repos/${repo.full_name}/releases?per_page=100`);
if(releases.length===100)throw Error('Paginate release history before publishing.');
const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
for(const release of releases){const previous=/^windows-staging-v(\d+\.\d+\.\d+)$/.exec(release.tag_name);if(previous&&compare(version,previous[1])<=0)throw Error('Increase the Windows version beyond every prior release, including drafts.');}
console.log('Exact source, private reviewed signing environment and increasing Windows staging version verified.');
