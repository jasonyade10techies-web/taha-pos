import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
if(!process.env.TAURI_SIGNING_PRIVATE_KEY||!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD)throw Error('Approved staging signing secrets are not configured.');
const root=path.resolve('artifacts/windows-native'),version=JSON.parse(await readFile('src-tauri/tauri.conf.json','utf8')).version;
const files=[];let provenance;
async function walk(directory){for(const item of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isSymbolicLink())throw Error('Unexpected native artifact link.');if(item.isDirectory())await walk(file);else if(/(?:-setup\.exe|\.msi)$/.test(file))files.push(file);else if(item.name==='deployment.json')provenance=JSON.parse(await readFile(file,'utf8'));}}
await walk(root);if(files.length!==2||provenance?.sourceCommit!==process.env.GITHUB_SHA||provenance?.ui!=='bundled')throw Error('Native artifacts do not match this exact source commit.');
for(const file of files){if(!path.basename(file).includes('_'+version+'_'))throw Error('Installer version does not match source.');try{execFileSync(process.execPath,['node_modules/@tauri-apps/cli/tauri.js','signer','sign','--app-version',version,file],{stdio:['ignore','pipe','pipe']});}catch{throw Error('Native signing failed; no signing output or secrets are printed.');}}
console.log('Signed the exact reviewed native artifacts. Independent verification is performed during packaging.');
