import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HealthController} from '../src/health.controller';
import type {Database} from '../src/database/database.service';
import type {ReadinessService} from '../src/health/readiness.service';
import type {Response} from 'express';
import type {AuthRequest} from '../src/auth/auth.guard';

const request={actor:{userId:'fixture',sessionId:'fixture-session'}} as AuthRequest;
function controller(authorized=true,schema=true,storage=true){
 const db={context:async()=>({store:{id:'fixture-shop'}}),permission:async()=>authorized,query:async()=>({rows:[{schema_ready:schema}]})} as unknown as Database;
 const readiness={check:async()=>({status:schema&&storage?'ready':'degraded',checks:{schema:schema?'pass':'fail',privateStorage:storage?'pass':'fail'}})} as unknown as ReadinessService;
 return new HealthController(db,readiness);
}
function response(){let code=200;return {value:{status:(next:number)=>{code=next;}} as unknown as Response,status:()=>code};}
test('readiness requires owner-level settings permission',async()=>{await assert.rejects(()=>controller(false).ready(request,response().value),/permission|owner|authorized/i);});
test('readiness checks actual schema and private object storage without exposing provider errors',async()=>{
 assert.equal((await controller().ready(request,response().value)).status,'ready');
 for(const args of [[true,false,true],[true,true,false]]){const res=response(),result=await controller(...args).ready(request,res.value);assert.equal(res.status(),503);assert.equal(result.status,'degraded');assert(!JSON.stringify(result).includes('private provider secret'));}
});
