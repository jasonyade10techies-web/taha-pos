import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {copyFile,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';

/** Preserve readable development uploads outside Windows Temp. Never remove or overwrite a source. */
export async function prepareLocalMedia(source:string){
 const destination=path.resolve(__dirname,'../data/local-acceptance-media');
 const manifest:{path:string;sha256:string;bytes:number}[]=[];
 const hash=async(file:string)=>createHash('sha256').update(await readFile(file)).digest('hex');
 async function copy(directory:string,relative=''){
  let entries;try{entries=await readdir(directory,{withFileTypes:true});}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  for(const entry of entries){
   if(entry.isSymbolicLink())throw new Error('Development media contains a symbolic link; inspect before copying.');
   const name=path.join(relative,entry.name),from=path.join(source,name),to=path.join(destination,name);
   if(entry.isDirectory()){await copy(from,name);continue;}if(!entry.isFile())continue;
   const sha256=await hash(from);await mkdir(path.dirname(to),{recursive:true});
   try{await copyFile(from,to,constants.COPYFILE_EXCL);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
   if(await hash(to)!==sha256)throw new Error('A development media copy differs. Both copies were retained for inspection.');
   manifest.push({path:name,sha256,bytes:(await stat(to)).size});
  }
 }
 await mkdir(destination,{recursive:true});
 if(path.resolve(source)!==destination)await copy(source);
 const manifestPath=path.join(destination,'local-copy-manifest.json');
 let previous:{files?:typeof manifest}={};
 try{previous=JSON.parse(await readFile(manifestPath,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const files=new Map((previous.files??[]).map(file=>[file.path,file]));
 for(const file of manifest)files.set(file.path,file);
 await writeFile(manifestPath,JSON.stringify({copiedAt:new Date().toISOString(),source,sourceRetained:true,files:[...files.values()]},null,2));
 return destination;
}
