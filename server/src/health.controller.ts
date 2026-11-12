import {Controller,Get,Inject,ServiceUnavailableException,UseGuards,Req,Res,Query,ForbiddenException} from '@nestjs/common';
import type {Response} from 'express';
import {ApiTags} from '@nestjs/swagger';
import {Database} from './database/database.service';
import {AuthGuard,type AuthRequest} from './auth/auth.guard';
import {ReadinessService} from './health/readiness.service';
@ApiTags('Health') @Controller('health')
export class HealthController{
 constructor(@Inject(Database) private readonly db:Database,@Inject(ReadinessService) private readonly readiness:ReadinessService){}
 @Get('live') live(){return {application:'taha-pos',status:'ok',version:'0.1.0',timestamp:new Date().toISOString()};}
 @Get() async health(){try{await this.db.query('select 1');}catch{throw new ServiceUnavailableException({status:'error',database:'unavailable',version:'0.1.0',timestamp:new Date().toISOString()});}return {application:'taha-pos',status:'ok',database:'connected',readiness:'not-assessed',version:'0.1.0',timestamp:new Date().toISOString()};}
 @Get('readyz') async summary(@Res({passthrough:true}) response:Response){
  const result=await this.readiness.check();response.status(result.status==='ready'?200:503);
  return {application:result.application,status:result.status,version:result.version,checkedAt:result.checkedAt};
 }
 @UseGuards(AuthGuard) @Get('ready') async ready(@Req() request:AuthRequest,@Res({passthrough:true}) response:Response,@Query('refresh') refresh='0'){
  const context=await this.db.context(request.actor);
  if(!context.store||!await this.db.permission(request.actor,'settings.manage',context.store.id))throw new ForbiddenException('An authorized owner must review deployment readiness.');
  const result=await this.readiness.check(refresh==='1');response.status(result.status==='ready'?200:503);return result;
 }
}
