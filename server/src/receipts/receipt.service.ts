import {Inject,Injectable,NotFoundException} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import {createHash,createHmac} from 'node:crypto';
import {CONFIG,type Configuration} from '../config';
import {Database} from '../database/database.service';
type Receipt={invoice:string;createdAt:string;status:string;subtotal:number;discount:number;couponDiscount?:number;total:number;paid:number;paymentsReceived?:number;refunded?:number;reversed?:number;outstanding:number;change:number;tax?:{name:string;rate:number;amount:number};receipt:{branch:string;phone:string;footer:string};items:{name:string;variant:string;quantity:number;unitPrice:number;total:number}[]};
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const money=(value:unknown)=>`PKR ${Number(value??0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
/** Receipt capabilities have a separate audience and never authenticate an account. */
@Injectable()
export class ReceiptService{
 constructor(@Inject(Database) private readonly db:Database,@Inject(CONFIG) private readonly config:Configuration){}
 async url(store:string,sale:string,_reference?:string){
  // Domain-separated HMAC gives a stable 256-bit opaque reference, without
  // leaking shop/sale IDs or creating a new row on every list refresh.
  const token=createHmac('sha256',this.config.secret).update('taha-receipt-reference-v1\n'+store+'\n'+sale).digest('base64url');
  await this.db.query("insert into app_private.receipt_references(token_hash,store_id,sale_id,expires_at) values($1,$2,$3,now()+interval '30 days') on conflict(token_hash) do update set expires_at=excluded.expires_at",[createHash('sha256').update(token).digest('hex'),store,sale]);
  return `${this.config.publicUrl}/api/v1/receipts/${token}`;
 }
 async read(token:string){let claims:jwt.JwtPayload;try{
  if(/^[A-Za-z0-9_-]{43}$/.test(token)){
   claims=(await this.db.query('select store_id as store,sale_id as sale from app_private.receipt_references where token_hash=$1 and expires_at>now()',[createHash('sha256').update(token).digest('hex')])).rows[0];
   if(!claims)throw new Error();
  }else claims=jwt.verify(token,this.config.secret,{algorithms:['HS256'],audience:'taha-customer-receipt',issuer:'taha-pos'}) as jwt.JwtPayload;
  if(typeof claims.store!=='string'||typeof claims.sale!=='string')throw new Error();
 }catch{throw new NotFoundException('This receipt link is invalid or expired. Ask the shop for a new copy.');}
  // Private helper returns a deliberately projected customer DTO, not sale_json or a financial row.
  const row=(await this.db.query('select app_private.customer_receipt($1,$2) value',[claims.store,claims.sale])).rows[0]?.value;
  if(!row)throw new NotFoundException('Receipt not found.');
  return row;
 }
 html(sale:Receipt){const rows=sale.items.map(item=>`<tr><td>${escape(item.name)}<small>${escape(item.variant)}</small></td><td>${item.quantity}</td><td>${money(item.unitPrice)}</td><td>${money(item.total)}</td></tr>`).join('');return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(sale.invoice)} · TAHA MOBILES</title><style>body{background:#f3f3f3;color:#17181a;font:14px system-ui;margin:0;padding:24px}main{max-width:740px;margin:auto;background:#fff;padding:28px;border-radius:12px;border-top:4px solid #f2bc2d}h1{color:#e53935;font-size:24px;margin:0}h2{font-size:20px}p{color:#667085}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{text-align:left;border-bottom:1px solid #e4e7ec;padding:10px 4px}small{display:block;color:#667085;font-size:11px}.totals{max-width:290px;margin-left:auto}.totals div{display:flex;justify-content:space-between;padding:7px 0}.total{font-size:20px;font-weight:700}footer{text-align:center;border-top:1px solid #e4e7ec;padding-top:16px;margin-top:24px;font-size:12px}@media(max-width:480px){body{padding:12px}main{padding:18px}td,th{font-size:11px;padding:8px 3px}}@media print{@page{size:A4;margin:12mm}body{padding:0;background:#fff}main{padding:0;border:0;box-shadow:none}thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body><main><h1>TAHA MOBILES</h1><p>${escape(sale.receipt.branch)} · ${escape(sale.receipt.phone)}</p><h2>${escape(sale.invoice)}</h2><p>${escape(new Date(sale.createdAt).toLocaleString('en-PK',{timeZone:'Asia/Karachi'}))} · ${escape(sale.status)}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Subtotal</span><span>${money(sale.subtotal)}</span></div><div><span>Discount</span><span>${money(sale.discount+(sale.couponDiscount??0))}</span></div>${sale.tax?.amount?`<div><span>${escape(sale.tax.name)} (${sale.tax.rate}%)</span><span>${money(sale.tax.amount)}</span></div>`:''}<div class="total"><span>Total</span><span>${money(sale.total)}</span></div><div><span>Paid</span><span>${money(sale.paymentsReceived??sale.paid)}</span></div>${sale.refunded?`<div><span>Refunded</span><span>${money(sale.refunded)}</span></div>`:""}${sale.reversed?`<div><span>Payment reversed</span><span>${money(sale.reversed)}</span></div>`:""}${sale.refunded||sale.reversed?`<div><span>Net paid</span><span>${money(sale.paid)}</span></div>`:""}<div><span>Outstanding</span><span>${money(sale.outstanding)}</span></div><div><span>Change</span><span>${money(sale.change)}</span></div></div><footer>${escape(sale.receipt.footer||'Thank you for choosing Taha Mobiles.')}</footer></main></body></html>`;}
}
