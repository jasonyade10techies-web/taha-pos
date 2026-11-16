import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {unzipSync} from 'fflate';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {packageDownloads} from '../android-release.mjs';
test('download packaging refuses unexpected files instead of including secrets',async()=>{const directory=await mkdtemp(path.join(tmpdir(),'taha-download-package-'));try{await writeFile(path.join(directory,'.env'),'PRIVATE_FIXTURE');await assert.rejects(packageDownloads(directory,'test',12),/Unexpected\/private/);}finally{await rm(directory,{recursive:true,force:true});}});
test('generated download ZIP runs its complete portal without repository files',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'taha-download-runtime-'));try{
  const input=path.join(directory,'input'),output=path.join(directory,'unpacked');await mkdir(input);await mkdir(output);
  const zip=await packageDownloads(input,'test',13);for(const [name,bytes]of Object.entries(unzipSync(await readFile(zip)))){await mkdir(path.dirname(path.join(output,name)),{recursive:true});await writeFile(path.join(output,name),bytes);}
  const module=await import(pathToFileURL(path.join(output,'software-handler.mjs')).href);assert.equal(typeof module.createSoftwareHandler,'function');
 }finally{await rm(directory,{recursive:true,force:true});}
});
