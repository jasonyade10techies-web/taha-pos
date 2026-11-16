import {execFileSync} from 'node:child_process';
const repo=process.env.GITHUB_REPOSITORY,sha=process.env.GITHUB_SHA;
if(process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||repo!=='jasonyade10techies-web/taha-pos'||process.env.GITHUB_ACTOR!=='jasonyade10techies-web'||process.env.TAHA_APPROVED_COMMIT!==sha||!/^[0-9a-f]{40}$/.test(sha??''))throw Error('Only the owner may manually promote the exact approved staging commit after verification.');
const api=args=>execFileSync('gh',['api',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const metadata=JSON.parse(api([`repos/${repo}`]));if(!metadata.private)throw Error('The source repository must remain private.');
const target=JSON.parse(api([`repos/${repo}/git/ref/heads/staging`])).object.sha;
if(target!==sha){const comparison=JSON.parse(api([`repos/${repo}/compare/${target}...${sha}`]));if(comparison.status!=='ahead')throw Error('Staging promotion must be a fast-forward; resolve divergence separately.');
 api(['--method','PATCH',`repos/${repo}/git/refs/heads/staging`,'-f',`sha=${sha}`,'-F','force=false']);}
console.log('Verified approved staging branch advanced without a merge or force push. A configured Hostinger Git connection can now redeploy this exact commit.');
