import {Controller,Get,Inject,Param,Res} from '@nestjs/common';
import type {Response} from 'express';
import {ReceiptService} from './receipt.service';
@Controller('receipts')
export class ReceiptController{
 constructor(@Inject(ReceiptService) private readonly receipts:ReceiptService){}
 @Get(':token/data') async data(@Param('token') token:string,@Res({passthrough:true}) response:Response){response.setHeader('Cache-Control','no-store');response.setHeader('Referrer-Policy','no-referrer');return this.receipts.read(token);}
 @Get(':token') async page(@Param('token') token:string,@Res() response:Response){const sale=await this.receipts.read(token);response.setHeader('Cache-Control','no-store');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");response.type('html').send(this.receipts.html(sale));}
}
