import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { CONFIG, type Configuration } from '../config';
import {databasePoolOptions} from './pool-options';
export interface Actor { userId:string; sessionId:string; counterToken?:string; companion?:{storeId:string;terminalId:string;deviceId:string} }
@Injectable()
export class Database implements OnModuleDestroy {
 readonly pool:Pool;
 constructor(@Inject(CONFIG) config:Configuration) {this.pool=new Pool(databasePoolOptions(config));this.pool.on('error',()=>{/* Replaced idle connections reconnect on the next bounded request; never log credentials. */});}
 async onModuleDestroy(){await this.pool.end();}
 query<T extends QueryResultRow=QueryResultRow>(sql:string,args:unknown[]=[]){return this.pool.query<T>(sql,args);}
 async transaction<T>(fn:(db:PoolClient)=>Promise<T>):Promise<T>{
  const db=await this.pool.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result;}
  catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async asActor<T>(actor:Actor,fn:(db:PoolClient)=>Promise<T>):Promise<T>{
  return this.transaction(async db=>{
   // Server-validated identity only; transaction-local settings prevent pooled identity leakage.
   await db.query(`select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.headers',$2,true)`,[actor.userId,JSON.stringify(actor.counterToken?{'x-counter-session':actor.counterToken}:{})]);
   await db.query('SET LOCAL ROLE authenticated');return fn(db);
  });
 }
 async context(actor:Actor){const context=await this.asActor(actor,async db=>(await db.query('select public.get_session_context() value')).rows[0].value);
  if(!actor.companion)return context;
  if(context.store?.id!==actor.companion.storeId)return {...context,profile:null,store:null,permissions:[]};
  return {...context,profile:context.profile?{...context.profile,role:'employee'}:null,permissions:['devices.pair','media.upload'],terminal:false,companion:{...actor.companion,scope:'camera'}};
 }
 async permission(actor:Actor,key:string,storeId:string){if(actor.companion&&(actor.companion.storeId!==storeId||!['devices.pair','media.upload'].includes(key)))return false;return this.asActor(actor,async db=>Boolean((await db.query('select public.has_permission($1,$2) value',[key,storeId])).rows[0].value));}
}
