import {Controller,Get,Inject,ServiceUnavailableException,UseGuards,Req,ForbiddenException} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {Database} from './database/database.service';
import {AuthGuard,type AuthRequest} from './auth/auth.guard';
import {LocalFileStorage} from './media/file-storage';
@ApiTags('Health') @Controller('health')
export class HealthController{
 constructor(@Inject(Database) private readonly db:Database,@Inject(LocalFileStorage) private readonly storage:LocalFileStorage){}
 @Get() async health(){try{await this.db.query('select 1');}catch{throw new ServiceUnavailableException({status:'error',database:'unavailable',version:'0.1.0',timestamp:new Date().toISOString()});}return {application:'taha-pos',status:'ok',database:'connected',version:'0.1.0',timestamp:new Date().toISOString()};}
 @UseGuards(AuthGuard) @Get('ready') async ready(@Req() request:AuthRequest){
  const context=await this.db.context(request.actor);
  if(!context.store||!await this.db.permission(request.actor,'settings.manage',context.store.id))throw new ForbiddenException('An authorized owner must review deployment readiness.');
  try{
   const result=await this.db.query("select to_regclass('app_private.sessions') is not null and to_regclass('app_private.sync_changes') is not null and to_regclass('app_private.receipt_references') is not null as schema_ready");
   if(!result.rows[0]?.schema_ready)throw new Error('Schema incomplete');
   await this.storage.probe();
   return {status:'ready',database:'connected',schema:'available',privateStorage:'reachable',timestamp:new Date().toISOString()};
  }catch{throw new ServiceUnavailableException('A required database or private storage integration is unavailable. Review the staging deployment configuration.');}
 }
}
