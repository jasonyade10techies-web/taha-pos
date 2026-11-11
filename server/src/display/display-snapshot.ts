import {BadRequestException} from '@nestjs/common';
type Json=Record<string,unknown>;
function object(value:unknown,keys:string[]):Json{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new BadRequestException('Invalid customer display information.');
 const input=value as Json;if(Object.keys(input).some(key=>!keys.includes(key)))throw new BadRequestException('Internal information cannot be sent to the customer display.');return input;
}
function text(value:unknown,max=120){if(typeof value!=='string'||value.length>max)throw new BadRequestException('Check the customer display text.');return value;}
function money(value:unknown){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e9)throw new BadRequestException('Check the displayed amount.');return value;}
function optionalNumbers(input:Json,keys:string[]){for(const key of keys)if(input[key]!==undefined)money(input[key]);}
export function displaySnapshot(value:unknown,terminalId:string,publicApiUrl?:string){
 const input=object(value,['tax','receiptUrl','mode','terminalId','displaySessionId','items','subtotal','discount','total','payment','couponDiscount','negotiatedDiscount','couponCode','cancelled','config','invoiceNumber','saleId','completedAt']);
 if(!['IDLE','CART_ACTIVE','CHECKOUT','PAYMENT','SALE_COMPLETE'].includes(String(input.mode))||input.terminalId!==terminalId)throw new BadRequestException('Check the customer display mode and counter.');
 if(!Array.isArray(input.items)||input.items.length>200)throw new BadRequestException('Too many displayed items.');
 for(const value of input.items){const item=object(value,['id','name','variant','quantity','unitPrice']);text(item.id,100);text(item.name,240);text(item.variant);money(item.unitPrice);if(!Number.isInteger(item.quantity)||Number(item.quantity)<1||Number(item.quantity)>10000)throw new BadRequestException('Check the displayed quantity.');}
 for(const key of ['subtotal','discount','total'])money(input[key]);optionalNumbers(input,['couponDiscount','negotiatedDiscount']);
 for(const key of ['couponCode','displaySessionId','saleId','invoiceNumber'])if(input[key]!==undefined)text(input[key],100);
 if(input.invoiceNumber!==undefined&&!/^TM-INV-\d+$/.test(String(input.invoiceNumber)))throw new BadRequestException('Check the invoice number.');
 if(input.cancelled!==undefined&&typeof input.cancelled!=='boolean')throw new BadRequestException('Invalid sale cancellation state.');
 if(input.completedAt!==undefined&&(typeof input.completedAt!=='string'||!Number.isFinite(Date.parse(input.completedAt))))throw new BadRequestException('Invalid sale completion time.');
 if(input.payment!==undefined){const p=object(input.payment,['method','kind','total','cashReceived','change','paidNow','outstanding','title','number','iban','qr']);text(p.method,80);money(p.total);if(p.kind!==undefined&&!['Cash','Digital','Credit','Split'].includes(String(p.kind)))throw new BadRequestException('Invalid payment method.');optionalNumbers(p,['cashReceived','change','paidNow','outstanding']);for(const key of ['title','number','iban'])if(p[key]!==undefined)text(p[key]);
  if(p.qr!==undefined){const qr=text(p.qr,260000);let localApiImage=false;try{const address=new URL(qr),api=publicApiUrl?new URL(publicApiUrl):undefined;localApiImage=!!api&&address.origin===api.origin&&/^\/api\/v1\/media\/[0-9a-f-]{36}$/i.test(address.pathname);}catch{/* Base64 images do not have a URL. */}if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(qr)&&!/^https:\/\/[^\s]+$/.test(qr)&&!localApiImage)throw new BadRequestException('Use a secure payment QR image.');if(!qr.startsWith('data:')&&qr.length>2048)throw new BadRequestException('Payment QR address is too long.');}
 }
 if(input.config!==undefined){const c=object(input.config,['phone','address','promotions','paymentQr','enabled','fullscreen','completeDuration','methods']);for(const key of ['phone','address'])if(c[key]!==undefined)text(c[key],240);for(const key of ['promotions','paymentQr','enabled','fullscreen'])if(typeof c[key]!=='boolean')throw new BadRequestException('Invalid customer display preference.');if(typeof c.completeDuration!=='number'||c.completeDuration<3||c.completeDuration>120)throw new BadRequestException('Use a sale completion duration from 3 to 120 seconds.');if(!Array.isArray(c.methods)||c.methods.length>20)throw new BadRequestException('Check the enabled payment methods.');for(const value of c.methods){const method=object(value,['name','kind']);text(method.name,80);text(method.kind,30);}}
 if(input.tax!==undefined){const tax=object(input.tax,['name','rate','mode','amount']);text(tax.name,80);money(tax.rate);money(tax.amount);if(!['Exclusive','Inclusive'].includes(String(tax.mode))||Number(tax.rate)>100)throw new BadRequestException('Invalid displayed tax.');}
 if(input.receiptUrl!==undefined){const value=text(input.receiptUrl,2048);try{const address=new URL(value),api=new URL(publicApiUrl!);if(address.origin!==api.origin||!/^\/api\/v1\/receipts\/[A-Za-z0-9_.-]+$/.test(address.pathname))throw new Error();}catch{throw new BadRequestException('Invalid receipt address.');}}
 // Build a fresh JSON tree; no class properties/prototypes or references reach persistence.
 return JSON.parse(JSON.stringify(input)) as Json;
}
export const idleDisplay=(terminalId='')=>({mode:'IDLE',terminalId,items:[],subtotal:0,discount:0,total:0});
