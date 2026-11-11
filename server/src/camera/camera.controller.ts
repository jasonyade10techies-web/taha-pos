import {Body,Controller,Delete,Get,Inject,Param,Patch,Post,Query,Req,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {MediaService} from '../media/media.service';
import {ApiBearerAuth,ApiTags,ApiConsumes} from '@nestjs/swagger';
import {AuthGuard,type AuthRequest} from '../auth/auth.guard';
import {CameraService} from './camera.service';
import {PushService} from './push.service';
import type {PushSubscription} from 'web-push';
@ApiTags('Camera') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('stores/:storeId')
export class CameraController{
 constructor(@Inject(CameraService) private readonly camera:CameraService,@Inject(PushService) private readonly push:PushService,@Inject(MediaService) private readonly media:MediaService){}
 @Post('camera/pairing') pairing(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:{terminalId:string}){return this.camera.pairing(r.actor,s,b.terminalId);}
 @Post('camera/pair') pair(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:{code:string,deviceName:string,deviceId?:string}){return this.camera.pair(r.actor,s,b.code,b.deviceName,b.deviceId);}
 @Post('camera/terminals/register') registerTerminal(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:{terminalId:string,name?:string}){return this.camera.registerTerminal(r.actor,s,b);}
 @Get('camera/terminals/register') terminal(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('terminalId') t:string){return this.camera.terminalStatus(r.actor,s,t);}
 @Post('camera/devices/register') registerDevice(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:{deviceId:string,name?:string,platform?:string}){return this.camera.registerDevice(r.actor,s,b);}
 @Post('camera/devices/heartbeat') heartbeat(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:{deviceId?:string,terminalId?:string}){return this.camera.heartbeat(r.actor,s,b);}
 @Get('camera/devices') devices(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('terminalId') t?:string){return this.camera.devices(r.actor,s,t);}
 @Delete('camera/devices/:id') disconnect(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.camera.disconnect(r.actor,s,id);}
 @Patch('camera/devices/:id') rename(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Body() b:{deviceName:string}){return this.camera.rename(r.actor,s,id,b.deviceName);}
 @Delete('camera/pairings') reset(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('terminalId') t:string){return this.camera.reset(r.actor,s,t);}
 @Post('camera/devices/:id/test') connectionTest(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.camera.connectionTest(r.actor,s,id);}
 @Get('camera/jobs') jobs(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('terminalId') t?:string){return this.camera.jobs(r.actor,s,t);}
 @Post('camera/jobs') request(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:Parameters<CameraService['request']>[2]){return this.camera.request(r.actor,s,b);}
 @Get('camera/jobs/:id') job(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.camera.getJob(r.actor,s,id);}
 @Post('camera/jobs/:id/confirm') confirm(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.camera.confirm(r.actor,s,id);}
 @Patch('camera/jobs/:id') update(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Body() b:{status:string,mediaId?:string}){return this.camera.update(r.actor,s,id,b.status,b.mediaId);}
 @Post('camera/jobs/:id/captures') @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1,fields:2}})) capture(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@UploadedFile() file:Express.Multer.File,@Body() b:{captureId:string}){return this.media.capture(r.actor,s,id,file,b.captureId);}
 @Post('camera/jobs/:id/claim') claim(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Body() b:{token:string}){return this.camera.claim(r.actor,s,id,b.token);}
 @Post('camera/jobs/:id/qr') qr(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.camera.qrHandoff(r.actor,s,id);}
 @Post('camera/jobs/:id/finish') finish(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.camera.finish(r.actor,s,id);}
 @Post('camera/test') diagnostic(@Req() r:AuthRequest,@Param('storeId') s:string){return this.camera.diagnostic(r.actor,s);}
 @Delete('camera/jobs/:id/test') removeTest(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.media.removeDiagnostic(r.actor,s,id);}
 @Get('push/key') key(){return {publicKey:this.push.publicKey};}
 @Post('push/subscriptions') subscribe(@Req() r:AuthRequest,@Body() b:PushSubscription){return this.push.subscribe(r.actor,b);}
 @Delete('push/subscriptions') unsubscribe(@Req() r:AuthRequest,@Body() b:{endpoint:string}){return this.push.remove(r.actor,b.endpoint);}
}
