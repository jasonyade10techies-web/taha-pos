import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HealthController} from '../src/health.controller';
import type {Database} from '../src/database/database.service';
import type {LocalFileStorage} from '../src/media/file-storage';
import type {AuthRequest} from '../src/auth/auth.guard';

const request={actor:{userId:'fixture',sessionId:'fixture-session'}} as AuthRequest;
function controller(authorized=true,schema=true,storage=true){
 const db={context:async()=>({store:{id:'fixture-shop'}}),permission:async()=>authorized,query:async()=>({rows:[{schema_ready:schema}]})} as unknown as Database;
 const files={probe:async()=>{if(!storage)throw new Error('private provider secret');}} as unknown as LocalFileStorage;
 return new HealthController(db,files);
}
test('readiness requires owner-level settings permission',async()=>{await assert.rejects(()=>controller(false).ready(request),/permission|owner|authorized/i);});
test('readiness checks actual schema and private object storage without exposing provider errors',async()=>{
 assert.equal((await controller().ready(request)).status,'ready');
 for(const args of [[true,false,true],[true,true,false]])await assert.rejects(()=>controller(...args).ready(request),error=>error instanceof Error&&!error.message.includes('private provider secret'));
});
