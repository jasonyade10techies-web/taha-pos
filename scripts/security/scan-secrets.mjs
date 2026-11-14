import {spawnSync,execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,cp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function safeSourcePath(name){
 if(name==='.env.development')return name;
 if(!name||name.includes('\\')||path.posix.isAbsolute(name)||/^[A-Za-z]:/.test(name)||name.split('/').some(part=>part==='..'||part==='.')||/^(?:\.tools|\.test-postgres|artifacts|node_modules|server\/(?:data|node_modules|distribution)|dist(?:-[^/]+)?)(?:\/|$)/.test(name)||/(?:^|\/)(?:\.env(?:\..*)?|[^/]+\.(?:keystore|jks|key|p12|pfx|dump|sqlite|sqlite3|db|apk|aab|zip))$/.test(name)&&!/(?:^|\/)\.env(?:\.[a-z-]+)?\.example$/.test(name))throw Error('Private/generated path rejected: '+name);
 return name;
}
async function main(){
 const evidence=path.join(root,'.test-postgres/r3a-20261114/security');await mkdir(evidence,{recursive:true});
 const mirror=await mkdtemp(path.join(evidence,'tracked-source-'));
 try{
  const files=[...new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean))];
  for(const file of files){safeSourcePath(file);if(file==='.env.development'){const content=await readFile(path.join(root,file),'utf8');for(const line of content.split(/\r?\n/).filter(line=>line.trim()&&!line.trim().startsWith('#')))if(!/^VITE_(?:DATA_PROVIDER=(?:api|local)|USE_MOCK_AUTH=(?:true|false)|API_BASE_URL=(?:http:\/\/(?:127\.0\.0\.1|localhost):[0-9]+(?:\/api\/v1)?|\/api\/v1))$/.test(line.trim()))throw Error('Development frontend config contains an unapproved value.');}await mkdir(path.dirname(path.join(mirror,file)),{recursive:true});await cp(path.join(root,file),path.join(mirror,file),{dereference:false,errorOnExist:true});}
  const executable=process.env.GITLEAKS_PATH||path.join(root,'.tools/security',process.platform==='win32'?'gitleaks.exe':'gitleaks');
  const scans=[];
  for(const [name,args] of [['history',['git',root,'--log-opts=--all']],['source',['dir',mirror]]]){
   const report=path.join(evidence,name+'-redacted.json');const result=spawnSync(executable,[...args,'--redact=100','--no-banner','--report-format=json','--report-path='+report],{cwd:root,encoding:'utf8',windowsHide:true});
   if(result.error)throw Error('Install the pinned scanner with node scripts/security/setup-gitleaks.mjs.');
   let findings=[];try{findings=JSON.parse(await readFile(report,'utf8'));}catch{if(result.status!==0)throw Error('Secret scan failed without a report.');}
   scans.push({name,exitCode:result.status,findings:findings.length,report});console.log(JSON.stringify({scan:name,exitCode:result.status,findings:findings.length}));
   // Only redacted rule/path/line is displayed. Full redacted evidence remains ignored locally.
   for(const f of findings)console.log(JSON.stringify({rule:f.RuleID,file:f.File,line:f.StartLine,commit:f.Commit?.slice(0,8)}));
  }
  await writeFile(path.join(evidence,'summary.json'),JSON.stringify({timestamp:new Date().toISOString(),files:files.length,scans},null,2));
  if(scans.some(scan=>scan.exitCode!==0))throw Error('Source publication blocked until secret findings are reviewed.');
 }finally{const resolved=path.resolve(mirror);if(resolved.startsWith(evidence+path.sep))await rm(resolved,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
