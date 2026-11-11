import {searchProducts,defaultSearchDictionary} from './product-search';
import {sanitizeDescription,validateDictionary} from './product-content';
import {ReceiptService} from '../receipts/receipt.service';
import {Inject,Injectable,BadRequestException} from '@nestjs/common';
import {Database,type Actor} from '../database/database.service';
import {resolveOperation} from './operations';
import {CounterGateway} from '../realtime/counter.gateway';
import {validateAppearance} from './appearance';
export function uuid(value:string){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new BadRequestException('Invalid record reference.');return value;}
@Injectable()
export class BusinessService {
 constructor(@Inject(Database) readonly db:Database,@Inject(CounterGateway) private readonly realtime:CounterGateway,@Inject(ReceiptService) private readonly receiptLinks:ReceiptService){}
 async operation(actor:Actor,store:string,key:string,body:Record<string,unknown>={},query:Record<string,unknown>={},id?:string){
  uuid(store);if(id)uuid(id);const op=resolveOperation(key);
  if(key==='products.save')body.description_html=sanitizeDescription(body.description_html);
  if(key==='settings.save'&&body.searchDictionary!==undefined)validateDictionary(body.searchDictionary);
  if(key==='appearance.save')validateAppearance(body);
  if(key==='settings.save'&&body.appearance!==undefined){validateAppearance(body.appearance);if(!await this.db.permission(actor,'appearance.customize',store)&&!await this.db.permission(actor,'settings.manage',store))throw new BadRequestException('Appearance permission required.');}
  const source={...query,...body,store,body,query,id};
  // node-postgres treats JavaScript arrays as PostgreSQL arrays. Cart lines are
  // JSONB; permission keys are deliberately still PostgreSQL text[].
  const args=op.args.map(name=>name==='lines'?JSON.stringify(source[name as keyof typeof source]??[]):source[name as keyof typeof source]??null);
  if(key==='approvals.create'&&body.payload&&typeof body.payload==='object'){
   const payload=body.payload as Record<string,unknown>;
   if(typeof payload.productId==='string'&&payload.productId.startsWith('custom:')){if(!await this.db.permission(actor,'services.create_custom',store))throw new BadRequestException('Custom service permission required.');payload.productId=uuid(payload.productId.slice(7));}
  }
  const value=await this.db.asActor(actor,async db=>(await db.query(`select public.${op.function}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value);
  if(['save','archive','duplicate','complete','void','return','receive','transfer','adjust','permissions','pin','send','update','reverse','create','action','note','history'].includes(key.split('.').at(-1)??''))await this.realtime.changed(actor,store,key.split('.')[0]);
  if((key==='sales.get'||key==='sales.complete')&&value?.id)value.receiptUrl=await this.receiptLinks.url(store,value.id,value.invoice);
  if((key==='sales.list'||key==='returns.receipts')&&Array.isArray(value?.rows))await Promise.all(value.rows.map(async(sale:{id?:string;invoice?:string;receiptUrl?:string})=>{if(sale?.id)sale.receiptUrl=await this.receiptLinks.url(store,sale.id,sale.invoice);}));
  return value;
 }
 async data(actor:Actor,store:string,kind:string,query:Record<string,unknown>={}){
  uuid(store);return this.db.asActor(actor,async db=>(await db.query('select public.transaction_data($1,$2,$3) value',[store,kind,query])).rows[0].value);
 }
 async search(actor:Actor,store:string,query:string){if(query.length>200)throw new BadRequestException('Keep search under 200 characters.');const rows=await this.operation(actor,store,'products.pos') as {name:string;brand:string;compatible_model:string;internal_code:string;aliases:string[]}[];const settings=await this.operation(actor,store,'settings.get');return searchProducts(rows.map(row=>({name:row.name,brand:row.brand,compatibleModel:row.compatible_model,internalCode:row.internal_code,aliases:row.aliases??[],row})),query,settings.searchDictionary??defaultSearchDictionary).map(item=>item.row);}
 async read(actor:Actor,store:string,resource:string,id?:string){
  uuid(store);if(id)uuid(id);
  // Static SELECT definitions. Sensitive columns reside in separate RLS-protected tables.
  const reads:Record<string,string>={
   products:'select p.*,p.updated_at::text updated_at from public.products p where store_id=$1 and not custom_sale_only order by internal_code limit 2000',
   product:'select p.*,p.updated_at::text updated_at from public.products p where store_id=$1 and id=$2',
   cost:'select purchase_cost from public.product_financials where store_id=$1 and product_id=$2',
   values:'select id,kind,value from public.catalog_values where store_id=$1 order by kind,value',
   locations:'select l.*,l.updated_at::text updated_at from public.locations l where store_id=$1 order by internal_code limit 2000',
   balances:'select * from public.stock_balances where store_id=$1 order by product_id,location_id limit 5000',
   movements:'select * from public.stock_movements where store_id=$1 order by created_at desc limit 1000',
   suppliers:'select id,name,phone,whatsapp,address,notes from public.suppliers where store_id=$1 order by name limit 2000',
   audit:'select * from public.audit_logs where store_id=$1 order by created_at desc limit 1000',
   shifts:'select * from public.shifts where store_id=$1 order by created_at desc limit 1000',
  };
  if(!Object.hasOwn(reads,resource))throw new BadRequestException('Unsupported dataset.');
  return this.db.asActor(actor,async db=>{
   if(resource==='cost' && !(await db.query("select public.has_permission('costs.view_purchase_cost',$1) allowed",[store])).rows[0].allowed)return null;
   const rows=(await db.query(reads[resource],id?[store,id]:[store])).rows;
   return resource==='product'?rows[0]??null:resource==='cost'?rows[0]?.purchase_cost===undefined?null:Number(rows[0].purchase_cost):rows;
  });
 }
 receipts(actor:Actor,store:string){uuid(store);return this.db.asActor(actor,async db=>{
  const receipts=(await db.query('select * from public.stock_receipts where store_id=$1 order by created_at desc limit 500',[store])).rows;
  const lines=(await db.query('select * from public.stock_receipt_lines where store_id=$1 order by receipt_id,line_no limit 5000',[store])).rows;
  const costs=(await db.query('select * from public.stock_receipt_costs where store_id=$1 order by receipt_id,line_no limit 5000',[store])).rows;
  return {receipts,lines,costs};
 });}
 profile(actor:Actor,fullName:string,phone:string){return this.db.asActor(actor,async db=>{await db.query('select public.update_my_profile($1,$2)',[fullName,phone]);return {ok:true};});}
}
