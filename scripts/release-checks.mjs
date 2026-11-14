import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,openSync,closeSync,writeFileSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import pg from 'pg';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function isolatedPostgres(value){
 const url=new URL(value||'');assert.equal(url.protocol,'postgresql:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55459');assert.equal(url.pathname,'/postgres');assert.equal(url.username,'taha_phase5c');assert.equal(url.search,'');assert.equal(url.hash,'');return url.toString();
}
export function isolatedIdentity(directory,role){assert.match(directory.replaceAll('\\','/'),/\/\.test-postgres\/phase5c-20261014\/pgdata$/);assert.equal(role,'taha_phase5c');}
export const checks=[
 ['frontend-types','.', 'typecheck'],['frontend-lint','.', 'lint'],
 ['backend-types','server','typecheck'],['backend-lint','server','lint'],['backend-build','server','build'],['backend-tests','server','test'],
 ['frontend-suites','.', 'test'],['sqlite','.', 'test:desktop'],['tauri-config','.', 'validate:tauri'],
 ['sql-security-financial','.', 'test:security'],['stock-concurrency','.', 'test:concurrency'],['client-secrets-boundary','.', 'test:client-boundary'],['frontend-build','.', 'build'],
];
async function main(){
 const plan=[...checks,...(process.argv.includes('--android')?[['android-test-apk','.', 'build:apk']]:[])];
 if(process.argv.includes('--plan')){console.log(JSON.stringify(plan,null,2));return;}
 const connectionString=isolatedPostgres(process.env.TAHA_TEST_POSTGRES_URL),client=new pg.Client({connectionString});
 try{await client.connect();const row=(await client.query("select current_setting('data_directory') directory,current_user role")).rows[0];isolatedIdentity(row.directory,row.role);}finally{await client.end();}
 const npm=process.env.npm_execpath;assert(npm&&existsSync(npm),'Run this with npm run verify:release.');
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'),evidence=path.join(root,'.test-postgres','release-checks',stamp);mkdirSync(evidence,{recursive:true});
 const results={startedAt:new Date().toISOString(),environment:'local disposable PostgreSQL only; not cloud or physical acceptance',checks:[]};
 const save=()=>writeFileSync(path.join(evidence,'results.json'),JSON.stringify(results,null,2));save();
 for(const [name,cwd,script]of plan){
  const log=path.join(evidence,name+'.log'),fd=openSync(log,'wx'),startedAt=new Date().toISOString();let code;
  try{code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[npm,'run',script],{cwd:path.join(root,cwd),env:{...process.env,TAHA_TEST_POSTGRES_URL:connectionString},windowsHide:true,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',code=>resolve(code));});}finally{closeSync(fd);}
  results.checks.push({name,startedAt,finishedAt:new Date().toISOString(),exitCode:code,log});save();console.log(JSON.stringify({name,exitCode:code,log}));if(code!==0)throw Error('Release check failed: '+name+'. Inspect the retained log; no tests were suppressed.');
 }
 results.finishedAt=new Date().toISOString();results.passed=true;save();console.log('Local checks passed: '+evidence+'. Production packaging and real environment acceptance remain separate.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
