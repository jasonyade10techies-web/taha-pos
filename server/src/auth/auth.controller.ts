import {Body,Controller,Delete,Get,Inject,Param,Post,Req,Res,UseGuards,ForbiddenException} from '@nestjs/common';
import {ApiBearerAuth,ApiTags,ApiBody,ApiOperation} from '@nestjs/swagger';
import type {Request,Response} from 'express';
import {AuthService} from './auth.service';
import {AuthGuard,type AuthRequest} from './auth.guard';
import {Database} from '../database/database.service';
import {CONFIG,type Configuration} from '../config';
@ApiTags('Authentication') @Controller('auth')
export class AuthController{
 constructor(@Inject(AuthService) private readonly auth:AuthService,@Inject(Database) private readonly db:Database,@Inject(CONFIG) private readonly config:Configuration){}
 private cookie(res:Response,token:string){res.cookie('taha_refresh',token,{httpOnly:true,secure:this.config.cookieSecure,sameSite:'strict',path:'/api/v1/auth',maxAge:30*86400000});}
 private origin(req:Request){if(!req.headers.origin||!this.config.origins.includes(req.headers.origin))throw new ForbiddenException('Open Taha POS from its configured address.');}
 @Post('login') @ApiOperation({summary:'Internal staff login; no public signup'}) @ApiBody({schema:{type:'object',required:['email','password'],properties:{email:{type:'string',format:'email'},password:{type:'string',format:'password'},deviceName:{type:'string',maxLength:120}}}}) async login(@Body() b:{email:string,password:string,deviceName?:string},@Req() req:Request,@Res({passthrough:true}) res:Response){this.origin(req);const r=await this.auth.login(b.email,b.password,req.ip??'unknown',b.deviceName??req.headers['user-agent']??'Counter');this.cookie(res,r.refreshToken);return r.body;}
 @Post('refresh') async refresh(@Req() req:Request,@Res({passthrough:true}) res:Response){this.origin(req);const r=await this.auth.refresh(req.cookies?.taha_refresh);this.cookie(res,r.refreshToken);return r.body;}
 @ApiBearerAuth() @UseGuards(AuthGuard) @Get('session') session(@Req() req:AuthRequest){return this.db.context(req.actor);}
 @ApiBearerAuth() @UseGuards(AuthGuard) @Post('logout') async logout(@Req() req:AuthRequest,@Res({passthrough:true}) res:Response){await this.auth.logout(req.actor);res.clearCookie('taha_refresh',{path:'/api/v1/auth'});return {ok:true};}
 @ApiBearerAuth() @UseGuards(AuthGuard) @Post('change-password') password(@Req() req:AuthRequest,@Body() b:{currentPassword:string,newPassword:string}){return this.auth.changePassword(req.actor,b.currentPassword,b.newPassword);}
 @ApiBearerAuth() @UseGuards(AuthGuard) @Get('devices') devices(@Req() req:AuthRequest){return this.auth.devices(req.actor);}
 @ApiBearerAuth() @UseGuards(AuthGuard) @Delete('devices/:id') revoke(@Req() req:AuthRequest,@Param('id') id:string){return this.auth.revokeDevice(req.actor,id);}
 @ApiBearerAuth() @UseGuards(AuthGuard) @Get('counter/employees') employees(@Req() req:AuthRequest){return this.db.asActor(req.actor,async db=>(await db.query('select public.list_counter_employees() value')).rows[0].value);}
 @ApiBearerAuth() @UseGuards(AuthGuard) @Post('counter/verify') verify(@Req() req:AuthRequest,@Body() b:{profileId:string,pin:string}){return this.db.asActor(req.actor,async db=>(await db.query('select public.verify_counter_pin($1,$2) value',[b.profileId,b.pin])).rows[0].value);}
 @ApiBearerAuth() @UseGuards(AuthGuard) @Post('counter/lock') lock(@Req() req:AuthRequest){return this.db.asActor(req.actor,async db=>{await db.query('select public.lock_counter_session()');return {ok:true};});}
}
