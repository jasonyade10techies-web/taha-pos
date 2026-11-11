import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from '@nestjs/common';
import {createHash} from 'node:crypto';
import jwt,{type JwtPayload} from 'jsonwebtoken';
import {Database,type Actor} from '../database/database.service';
import {CONFIG,type Configuration} from '../config';
import {uuid} from '../business/business.service';
import {ReceiptService} from '../receipts/receipt.service';
export interface CashCaptureInput {
 grant:string;terminalId:string;createdAt:string;invoice:string;total:number;
 input:Record<string,unknown>;catalog:{id:string;price:number;minimum:number}[];
 tax?:{rate:number;mode:string;appliesTo:string};receipt?:unknown;
}
const canonical=(value:unknown):string=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
@Injectable()
export class CashReconciliationService {
 constructor(@Inject(Database)private db:Database,@Inject(CONFIG)private config:Configuration,@Inject(ReceiptService)private receipts:ReceiptService){}
 async resolver(actor:Actor,store:string){
  const c=await this.db.context(actor);
  if(c.store?.id!==store||!['owner','manager'].includes(c.profile?.role)||!await this.db.permission(actor,'sync.reconcile_cash',store))throw new ForbiddenException('Only the owner or an authorized manager can reconcile cash.');
  return c;
 }
 async register(actor:Actor,store:string,b:CashCaptureInput){
  uuid(store);let g:JwtPayload;
  try{g=jwt.verify(b.grant,this.config.secret,{algorithms:['HS256'],issuer:'taha-pos',audience:'taha-offline-cash',ignoreExpiration:true}) as JwtPayload;}
  catch{throw new ForbiddenException('This cash record has no valid counter authorization. Keep the receipt and ask the owner for assistance.');}
  const c=await this.db.context(actor),created=Date.parse(b.createdAt);
  if(g.storeId!==store||g.terminalId!==b.terminalId||!Number.isFinite(created)||created<Date.parse(g.issuedAt)||created>Date.parse(g.expiresAt)||created>Date.now()+60_000||c.store?.id!==store)throw new ForbiddenException('The counter authorization does not cover this shop or sale time.');
  uuid(g.profileId);uuid(b.terminalId);const id=uuid(String(b.input?.idempotencyKey??''));
  if(c.profile?.id!==g.profileId)await this.resolver(actor,store);
  const lines=b.input?.lines as {productId:string;quantity:number;unitPrice:number;customService?:unknown;approval?:unknown}[],payments=b.input?.payments as {methodId:string;amount:number}[];
  const tendered=Number(b.input?.cashReceived);
  if(b.invoice!=='TM-INV-O-'+id.toUpperCase()||!Number.isFinite(b.total)||b.total<=0||!Number.isSafeInteger(Math.round(b.total*100))||Math.abs(b.total*100-Math.round(b.total*100))>0.00001||!Number.isFinite(tendered)||tendered<b.total||Math.abs(tendered*100-Math.round(tendered*100))>0.00001||!Array.isArray(b.catalog)||b.catalog.length>100||!Array.isArray(lines)||!lines.length||lines.length>100||lines.some(l=>l.customService||l.approval||!Number.isInteger(l.quantity)||l.quantity<=0)||!Array.isArray(payments)||payments.length!==1||Number(payments[0].amount)!==b.total||b.input.coupon||b.input.sourceTestId)throw new BadRequestException('Offline checkout supports valid paid cash receipts and catalogue items only.');
  uuid(payments[0].methodId);lines.forEach(l=>uuid(l.productId));
  // Preserve cash even if the payment method/product was subsequently disabled.
  const payload={input:b.input,catalog:b.catalog,...(b.tax?{tax:b.tax}:{}),...(b.receipt?{receipt:b.receipt}:{})};
  const fingerprint=createHash('sha256').update(canonical({id,terminal:b.terminalId,seller:g.profileId,invoice:b.invoice,created:b.createdAt,total:b.total,payload})).digest('hex');
  await this.db.transaction(async db=>{
   // Serialize duplicate deliveries before both unique id/invoice indexes are
   // checked. ON CONFLICT(id) alone can race the separate invoice constraint.
   await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['cash-capture:'+id]);
   await db.query('insert into app_private.cash_captures(id,store_id,terminal_id,seller_id,invoice,captured_at,tendered,change_given,collected,fingerprint,payload,submitted_by,authorization_snapshot) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict(id) do nothing',[id,store,b.terminalId,g.profileId,b.invoice,b.createdAt,tendered,Math.round((tendered-b.total)*100)/100,b.total,fingerprint,payload,c.profile.id,{issuedAt:g.issuedAt,expiresAt:g.expiresAt,terminalId:g.terminalId,sellerId:g.profileId}]);
   const row=(await db.query('select fingerprint from app_private.cash_captures where id=$1 and store_id=$2',[id,store])).rows[0];
   if(row?.fingerprint!==fingerprint)throw new ConflictException('This invoice already has different cash evidence. The original receipt is retained.');
  });
  return {id,context:c,seller:g.profileId,created};
 }
 async import(actor:Actor,store:string,b:CashCaptureInput){
  const capture=await this.register(actor,store,b);
  const state=(await this.db.query('select state from app_private.cash_capture_state where id=$1 and store_id=$2',[capture.id,store])).rows[0]?.state;
  if(state==='POSTED')return this.post(actor,store,capture.id,'');
  if(capture.context.profile.id!==capture.seller||Date.now()-capture.created>30*86400_000){
   await this.event(actor,store,capture.id,'REVIEW','The original employee is unavailable or owner recovery is required.');
   throw new ConflictException('Cash is recorded. Open Synchronization Exceptions to review the original receipt and recover it.');
  }
  return this.post(actor,store,capture.id,'');
 }
 async post(actor:Actor,store:string,id:string,reason:string){
  try{
   const sale=await this.db.asActor(actor,async db=>{await db.query('RESET ROLE');return(await db.query('select app_private.post_cash_capture($1,$2,$3) value',[store,id,reason])).rows[0].value;});
   sale.receiptUrl=await this.receipts.url(store,sale.id,sale.invoice);return sale;
  }catch(error){
   const code=(error as {code?:string}).code;
   const review=error instanceof ForbiddenException||!!code&&['P0001','22023','42501','23505','23514','23503'].includes(code);
   const message=code==='42501'?'Your current account cannot post this receipt. An authorized owner or manager must review it.':review?(error as Error).message.split('\n')[0].slice(0,240):'The server could not post this receipt. The cash record is retained; retry is available.';
   await this.event(actor,store,id,review?'REVIEW':'FAILED',message,reason);
   if(review)throw new ConflictException(message);throw error;
  }
 }
 private async event(actor:Actor,store:string,id:string,state:string,reason:string,decisionReason=''){
  // Serialize with posting/refunds. A failed concurrent attempt must never
  // overwrite a completed decision with a later REVIEW event.
  await this.db.asActor(actor,async db=>{await db.query('RESET ROLE');await db.query('select app_private.cash_failure($1,$2,$3,$4,$5)',[store,id,state,reason,decisionReason]);});
 }
 async list(actor:Actor,store:string,ids:string[]=[]){await this.resolver(actor,store);if(ids.length>200)throw new BadRequestException('Refresh up to 200 retained receipt references at once.');ids.forEach(uuid);return(await this.db.query("select * from app_private.cash_capture_state where store_id=$1 and (id=any($2::uuid[]) or state not in ('POSTED','REFUNDED') or id in (select id from app_private.cash_capture_state where store_id=$1 and state in ('POSTED','REFUNDED') order by captured_at desc limit 200)) order by captured_at desc",[store,ids])).rows;}
 async resolve(actor:Actor,store:string,id:string,b:{action:string;reason:string;cashReturned?:number}){
  await this.resolver(actor,store);uuid(id);
  if(typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>1000)throw new BadRequestException('Explain the decision before continuing.');
  if(b.action==='retry')return {state:'POSTED',sale:await this.post(actor,store,id,b.reason.trim())};
  if(b.action!=='refund')throw new BadRequestException('Choose retry or an actual full cash refund. Linked amendments are not available.');
  try{return await this.db.asActor(actor,async db=>{await db.query('RESET ROLE');return(await db.query('select app_private.refund_cash_capture($1,$2,$3,$4) value',[store,id,b.reason.trim(),b.cashReturned])).rows[0].value;});}
  catch(error){if((error as {code?:string}).code==='22023')throw new ConflictException((error as Error).message);throw error;}
 }
 async summary(actor:Actor,store:string){await this.resolver(actor,store);return this.db.asActor(actor,async db=>{await db.query('RESET ROLE');return(await db.query("select app_private.cash_summary($1) value",[store])).rows[0].value;});}
}
