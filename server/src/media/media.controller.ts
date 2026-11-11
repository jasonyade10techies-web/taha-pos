import {Body,Controller,Delete,Get,Inject,Param,Patch,Post,Query,Req,Res,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiBearerAuth,ApiConsumes,ApiTags} from '@nestjs/swagger';
import type {Request,Response} from 'express';
import {AuthGuard,type AuthRequest} from '../auth/auth.guard';
import {MediaService} from './media.service';
@ApiTags('Media') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('stores/:storeId/media')
export class MediaController{
 constructor(@Inject(MediaService) private readonly media:MediaService){}
 @Post() @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:16*1024*1024,files:1,fields:8}})) upload(@Req() r:AuthRequest,@Param('storeId') s:string,@UploadedFile() f:Express.Multer.File,@Body() b:Parameters<MediaService['upload']>[3]){return this.media.upload(r.actor,s,f,b);}
 @Post('upload-grants') grant(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:Parameters<MediaService['createGrant']>[2]){return this.media.createGrant(r.actor,s,b);}
 @Post('upload-grants/:id/complete') complete(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.media.completeGrant(r.actor,s,id);}
 @Delete('upload-grants/:id') cancel(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.media.cancelGrant(r.actor,s,id);}
 @Post('urls') urls(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:{paths:string[]}){return this.media.urls(r.actor,s,b.paths);}
 @Post('crop') crop(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:Parameters<MediaService['crop']>[2]){return this.media.crop(r.actor,s,b);}
 @Get() list(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('entityType') kind:string,@Query('entityId') id:string){return this.media.list(r.actor,s,kind,id);}
 @Patch(':id') metadata(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Body() b:Parameters<MediaService['metadata']>[3]){return this.media.metadata(r.actor,s,id,b);}
 @Delete(':id') remove(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.media.remove(r.actor,s,id);}
}
@ApiTags('Media') @Controller('media')
export class MediaReadController{
 constructor(@Inject(MediaService) private readonly media:MediaService){}
 @Get(':id') async read(@Param('id') id:string,@Query('token') token:string,@Query('thumbnail') thumbnail:string,@Query('original') original:string,@Req() req:Request,@Res() res:Response){const image=await this.media.read(id,token,thumbnail==='1',original==='1',Boolean((req.socket as {encrypted?:boolean}).encrypted));res.set({'Content-Type':image.mimeType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'cross-origin'});res.send(image.buffer);}
}

