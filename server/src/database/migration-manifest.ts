import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export interface MigrationSource {name:string;checksum:string;source:string}
/** Preserve historical byte checksums and order, including compatibility first. */
export async function migrationManifest(root:string):Promise<MigrationSource[]>{
 const names=['0000_compatibility.sql',...(await readdir(path.join(root,'legacy'))).filter(name=>name.endsWith('.sql')).sort().map(name=>'legacy/'+name),...(await readdir(root)).filter(name=>name.endsWith('.sql')&&name!=='0000_compatibility.sql').sort()];
 return Promise.all(names.map(async name=>{const source=await readFile(path.join(root,name),'utf8');return{name,source,checksum:createHash('sha256').update(source).digest('hex')};}));
}
