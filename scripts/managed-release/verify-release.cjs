'use strict';
async function verify(){
const fs=await import('node:fs'),path=await import('node:path'),{createHash}=await import('node:crypto');
const root=path.resolve(__dirname),manifest=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
for(const file of manifest.files){const target=path.resolve(root,file.path);if(!target.startsWith(root+path.sep)||file.path.split('/').some(part=>part==='..'))throw Error('Invalid release path.');if(file.path==='package-lock.json'){if(file.verification!=='npm-runtime-pins-v1'||fs.statSync(target).size>8*1024*1024)throw Error('Invalid installer lockfile policy.');continue;}if(file.verification)throw Error('Unexpected release verification policy.');const bytes=fs.readFileSync(target);if(bytes.length!==file.size||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Release verification failed: '+file.path);}
for(const required of ['main.js','server.cjs','package-lock.json','release-lock.json','verify-lock.cjs','dist/main.js','dist-tools/scripts/migrate-staging.js','dist-tools/scripts/initialize-staging.js','dist-tools/scripts/seed-staging.js','public/index.html','public/deployment.json'])if(!manifest.files.some(file=>file.path===required))throw Error('Required release file missing: '+required);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(pkg.main!=='main.js'||pkg.scripts?.start!=='node main.js'||pkg.scripts?.build!=='node verify-release.cjs'||pkg.devDependencies)throw Error('Expected a precompiled server release without development build dependencies.');
const {verifyLock}=(await import('./verify-lock.cjs')).default;
verifyLock(JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(root,'release-lock.json'),'utf8')),pkg);
console.log(JSON.stringify({status:'verified',version:manifest.version,sourceCommit:manifest.sourceCommit,files:manifest.files.length}));
}
verify().catch(error=>{console.error(error.message);process.exitCode=1;});
