import 'dotenv/config';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {hashPassword,validatePassword} from '../src/auth/crypto';
// Trusted console workflow. Password is read from an environment variable, never a CLI argument/history.
async function provision(){
 const email=process.env.PROVISION_EMAIL?.trim().toLowerCase(),name=process.env.PROVISION_NAME,password=process.env.PROVISION_PASSWORD;
 const role=process.env.PROVISION_ROLE??'owner',store=process.env.PROVISION_STORE_ID??'10000000-0000-4000-8000-000000000001';
 if(!email||!name||!password||!['owner','manager','employee','terminal'].includes(role))throw new Error('Set PROVISION_EMAIL, PROVISION_NAME, PROVISION_PASSWORD and optional PROVISION_ROLE/STORE_ID.');
 validatePassword(password);const hash=await hashPassword(password),id=process.env.PROVISION_PROFILE_ID??randomUUID();
 const client=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});await client.connect();
 try{await client.query('BEGIN');
  if(process.env.PROVISION_PROFILE_ID){const existing=(await client.query('select id,email from public.profiles where id=$1',[id])).rows[0];if(!existing||existing.email.toLowerCase()!==email)throw new Error('PROVISION_PROFILE_ID must match the existing staff email.');}
  else{if((await client.query('select 1 from auth.users where lower(email)=$1',[email])).rowCount)throw new Error('This email already has an identity. Use PROVISION_PROFILE_ID to configure its account.');await client.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
   if(role==='terminal')await client.query('insert into public.counter_terminals(auth_user_id,store_id,name) values($1,$2,$3)',[id,store,name]);
   else{await client.query("insert into public.profiles(id,full_name,email,role,status) values($1,$2,$3,$4,'active')",[id,name,email,role]);await client.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);}}
  await client.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3) on conflict(user_id) do update set password_hash=excluded.password_hash,updated_at=now()',[id,email,hash]);await client.query('update app_private.sessions set revoked_at=coalesce(revoked_at,now()) where user_id=$1',[id]);await client.query('COMMIT');console.log(`Provisioned ${role} identity ${id}. No password was printed.`);
 }catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
}
provision().catch(e=>{console.error(e.message);process.exitCode=1;});
