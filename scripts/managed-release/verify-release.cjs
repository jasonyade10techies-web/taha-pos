'use strict';
async function verify(){
const fs=await import('node:fs'),path=await import('node:path'),{createHash}=await import('node:crypto');
const root=path.resolve(__dirname),manifest=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
for(const file of manifest.files){const target=path.resolve(root,file.path);if(!target.startsWith(root+path.sep)||file.path.split('/').some(part=>part==='..'))throw Error('Invalid release path.');const bytes=fs.readFileSync(target);if(bytes.length!==file.size||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Release verification failed: '+file.path);}
for(const required of ['server.cjs','dist/main.js','dist-tools/scripts/migrate-staging.js','dist-tools/scripts/seed-staging.js','public/index.html','public/deployment.json'])if(!manifest.files.some(file=>file.path===required))throw Error('Required release file missing: '+required);
console.log(JSON.stringify({status:'verified',version:manifest.version,sourceCommit:manifest.sourceCommit,files:manifest.files.length}));
}
verify().catch(error=>{console.error(error.message);process.exitCode=1;});
