import pg from 'pg';
import {migrate,runtimeRole} from './migrate';
// Development-only: preserve the current physical-test database, never provision/reset it.
async function main(){const runtime=process.env.DATABASE_URL;if(!runtime)throw new Error('Load server/.env.mobile-test first.');const admin=new URL(runtime);if(!['127.0.0.1','localhost'].includes(admin.hostname)||!admin.pathname.startsWith('/taha_api_browser_'))throw new Error('This helper only migrates the existing local mobile-test fixture.');admin.username='taha_test';admin.password='';const client=new pg.Client({connectionString:admin.toString()});await client.connect();try{await migrate(client);await runtimeRole(client,runtime);console.log('Existing mobile test fixture migrated; records preserved.');}finally{await client.end();}}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
