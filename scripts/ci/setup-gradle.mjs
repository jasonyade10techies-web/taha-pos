import {createHash} from 'node:crypto';
import {mkdir,writeFile,chmod} from 'node:fs/promises';
import {unzipSync} from 'fflate';
const base='https://services.gradle.org/distributions/gradle-8.11.1-bin.zip';
const [archive,checksum]=await Promise.all([fetch(base),fetch(base+'.sha256')]);if(!archive.ok||!checksum.ok)throw Error('Official Gradle download failed.');const bytes=new Uint8Array(await archive.arrayBuffer()),expected=(await checksum.text()).trim();
if(!/^[a-f0-9]{64}$/.test(expected)||createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Gradle checksum mismatch.');
for(const [file,content] of Object.entries(unzipSync(bytes))){if(file.includes('..')||file.startsWith('/'))throw Error('Unsafe archive.');if(file.endsWith('/'))await mkdir('.tools/'+file,{recursive:true});else{await mkdir('.tools/'+file.slice(0,file.lastIndexOf('/')),{recursive:true});await writeFile('.tools/'+file,content);if(file.endsWith('/bin/gradle'))await chmod('.tools/'+file,0o755);}}
