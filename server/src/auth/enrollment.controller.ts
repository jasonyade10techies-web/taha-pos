import {Body,Controller,Get,Inject,Param,Post,Req,UseGuards} from '@nestjs/common';
import type {Request} from 'express';
import {AuthGuard,type AuthRequest} from './auth.guard';
import {EnrollmentService} from './enrollment.service';
import {requireProtectedChannel} from './companion-policy';
@Controller('auth/enrollment')
export class EnrollmentController{
 constructor(@Inject(EnrollmentService) private readonly enrollment:EnrollmentService){}
 @UseGuards(AuthGuard) @Post() create(@Req() r:AuthRequest,@Body() b:Parameters<EnrollmentService['create']>[1]){return this.enrollment.create(r.actor,b);}
 @Post('refresh') refresh(@Req() r:Request,@Body() b:Parameters<EnrollmentService['refresh']>[0]){requireProtectedChannel(r);return this.enrollment.refresh(b);}
 @UseGuards(AuthGuard) @Get(':id') status(@Req() r:AuthRequest,@Param('id') id:string){return this.enrollment.status(r.actor,id);}
 @UseGuards(AuthGuard) @Post(':id/approve') approve(@Req() r:AuthRequest,@Param('id') id:string){return this.enrollment.approve(r.actor,id);}
 @Post(':id/request') request(@Req() r:Request,@Param('id') id:string,@Body() b:Parameters<EnrollmentService['request']>[1]){requireProtectedChannel(r);return this.enrollment.request(id,b);}
 @Post(':id/complete') complete(@Req() r:Request,@Param('id') id:string,@Body() b:Parameters<EnrollmentService['complete']>[1]){requireProtectedChannel(r);return this.enrollment.complete(id,b);}
}
