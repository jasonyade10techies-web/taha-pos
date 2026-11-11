import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {parse} from 'dotenv';
import pg from 'pg';
import {migrate,runtimeRole} from './migrate';

/** Existing localhost test database only. Never seeds, resets or targets a hosted shop. */
async function prepare(){
 const file=path.resolve(__dirname,'../.env.mobile-test'),env=parse(await readFile(file));
 const runtime=new URL(env.DATABASE_URL??'');
 if(!['127.0.0.1','localhost'].includes(runtime.hostname)||runtime.port!=='55439'||!/^taha_api_browser_\d+$/.test(runtime.pathname.slice(1)))
  throw new Error('Local acceptance requires the existing localhost development database on port 55439.');
 const admin=new URL(runtime);admin.username='taha_test';admin.password='';
 const db=new pg.Client({connectionString:admin.toString()});await db.connect();
 try{
  const applied=(await db.query('select name,checksum from app_migrations.applied')).rows;
  const root=path.resolve(__dirname,'../migrations');
  const paths=[...(await readdir(root)).filter(n=>n.endsWith('.sql')).map(n=>[n,path.join(root,n)]),...(await readdir(path.join(root,'legacy'))).filter(n=>n.endsWith('.sql')).map(n=>['legacy/'+n,path.join(root,'legacy',n)])];
  const mismatches:string[]=[],pending:string[]=[];
  for(const [name,filePath] of paths){const prior=applied.find(r=>r.name===name);if(!prior)pending.push(name);else if(prior.checksum!==createHash('sha256').update(await readFile(filePath)).digest('hex'))mismatches.push(name);}
  console.log(JSON.stringify({database:runtime.pathname.slice(1),applied:applied.length,pending:pending.sort(),modifiedAppliedMigrations:mismatches}));
  if(mismatches.length)throw new Error('Existing migration history differs. No history or data was rewritten; inspect the saved backup before proceeding.');
  if(process.argv.includes('--migrate')){await migrate(db);await runtimeRole(db,runtime.toString());console.log('Local development migrations and restricted runtime grants are ready. Existing accounts and business records were retained.');}
 }finally{await db.end();}
}
prepare().catch(e=>{console.error(e instanceof Error?e.message:'Local development database could not be prepared.');process.exitCode=1;});
