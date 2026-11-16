import {readFile,mkdir,writeFile,cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateWindowsRelease,verifyTauriSignature} from '../distribution/windows-manifest.mjs';
const input=path.resolve(process.argv[2]??''),output=path.resolve(process.argv[3]??'');
if(!input.startsWith(path.resolve('artifacts')+path.sep)||!output.startsWith(path.resolve('artifacts')+path.sep)||input===output)throw Error('Use distinct inspected artifact directories.');
const version=JSON.parse(await readFile('src-tauri/tauri.conf.json','utf8')).version;
const publicKey=(await readFile('src-tauri/updater-staging.pub','utf8')).trim(),files=[];
await mkdir(output,{recursive:false});
async function walk(directory){const result=[];for(const item of await readdir(directory,{withFileTypes:true})){if(item.isSymbolicLink())throw Error('Release inputs cannot be links.');const name=path.join(directory,item.name);if(item.isDirectory())result.push(...await walk(name));else if(/(?:-setup\.exe|\.msi)$/.test(name))result.push(name);}return result;}
for(const original of await walk(input)){
 const bytes=await readFile(original),signature=(await readFile(original+'.sig','utf8')).trim(),type=original.endsWith('.msi')?'msi':'nsis';
 verifyTauriSignature(bytes,signature,publicKey,version);
 const name=`Taha-POS-Staging-${version}-x64${type==='nsis'?'-setup.exe':'.msi'}`;
 await cp(original,path.join(output,name),{errorOnExist:true,force:false});await writeFile(path.join(output,name+'.sig'),signature+'\n',{flag:'wx'});
 files.push({type,url:`/downloads/taha-pos/windows/staging/${version}/${name}`,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signature});
}
if(files.length!==2)throw Error('Both verified NSIS and MSI inputs are required.');
const release=validateWindowsRelease({schemaVersion:1,platform:'windows-x86_64',channel:'staging',applicationId:'com.tahamobiles.pos.staging',version,releasedAt:new Date().toISOString(),releaseNotes:['Bundled Taha POS Windows staging application.','SQLite counter cache/outbox; physical offline acceptance remains required.','Version-bound signed update support. Windows publisher Authenticode certificate is not yet configured.'],sourceCommit:process.env.TAHA_WINDOWS_SOURCE_COMMIT??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files});
await writeFile(path.join(output,'release.json'),JSON.stringify(release,null,2)+'\n',{flag:'wx'});
await writeFile(path.join(output,'sha256.txt'),files.map(file=>file.sha256+'  '+path.basename(file.url)).join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({version,files:files.length,output,signature:'verified; version bound',authenticode:'not configured'}));
