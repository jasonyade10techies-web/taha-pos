import {Body,Controller,Delete,Get,Inject,Param,Post,Put,Query,Req,Res,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiTags} from '@nestjs/swagger';
import type {Request,Response} from 'express';
import {AuthGuard,type AuthRequest} from '../auth/auth.guard';
import {DisplayService} from './display.service';
@ApiTags('Customer Display') @Controller('displays')
export class PublicDisplayController{
 constructor(@Inject(DisplayService) private readonly display:DisplayService){}
 @Post() create(@Req() r:Request,@Body() b:{deviceName?:string}){return this.display.create(r.ip??'unknown',b.deviceName);}
 @Get(':id') read(@Req() r:Request,@Param('id') id:string,@Res({passthrough:true}) response:Response){response.setHeader('Cache-Control','no-store');return this.display.read(id,r.headers.authorization?.match(/^Bearer (.+)$/)?.[1]??'');}
}
@ApiTags('Customer Display') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('stores/:storeId/displays')
export class DisplayController{
 constructor(@Inject(DisplayService) private readonly display:DisplayService){}
 @Post('pair') pair(@Req() r:AuthRequest,@Param('storeId') store:string,@Body() b:{pairingCode:string,terminalId:string}){return this.display.pair(r.actor,store,b.pairingCode,b.terminalId);}
 @Get() list(@Req() r:AuthRequest,@Param('storeId') store:string,@Query('terminalId') terminal?:string){return this.display.list(r.actor,store,terminal);}
 @Get('preview') preview(@Req() r:AuthRequest,@Param('storeId') store:string,@Query('terminalId') terminal:string){return this.display.preview(r.actor,store,terminal);}
 @Put('preview') counterPreview(@Req() r:AuthRequest,@Param('storeId') store:string,@Body() b:{terminalId:string;snapshot:unknown}){return this.display.counterPreview(r.actor,store,b.terminalId,b.snapshot);}
 @Put(':id') publish(@Req() r:AuthRequest,@Param('storeId') store:string,@Param('id') id:string,@Body() b:{terminalId:string,snapshot:unknown}){return this.display.publish(r.actor,store,id,b.terminalId,b.snapshot);}
 @Delete(':id') revoke(@Req() r:AuthRequest,@Param('storeId') store:string,@Param('id') id:string){return this.display.revoke(r.actor,store,id);}
}
