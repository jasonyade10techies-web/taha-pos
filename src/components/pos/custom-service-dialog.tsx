import { useEffect, useMemo, useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field, CurrencyInput } from '../ui/workspace';
import { AppCheckbox } from '../ui/app-checkbox';
import { useCartStore } from '../../stores/cart-store';
import { usePermission } from '../../hooks/use-permission';
import { localDemoEnabled, apiEnabled } from '../../lib/config';
import { repositories } from '../../lib/repositories';
import { useAction, useRepository } from '../../hooks/use-repository';
import { recognizeServiceMaterial, suggestServiceTemplates } from '../../lib/smart-services';
import { useSyncStore } from '../../stores/sync-store';
import { currency } from '../../lib/utils';
import { ServiceMaterialAllocation } from './service-material-allocation';
import {ServiceMentionComposer} from './service-mention-composer';
import {emptyServiceDocument,composerText,type ServiceDocument} from '../../lib/service-composer';
import {CompoundPriceBreakdown} from './compound-price-breakdown';
import type {PosProduct} from '../../types/product';
import type {RepairService} from '../../types/demo';
import '../../styles/smart-services.css';

export function CustomServiceDialog() {
 const canCreate=usePermission('services.create_custom'),canConsume=usePermission('services.consume_inventory'),canCatalog=usePermission('services.save_catalog'),canManage=usePermission('repair.services.manage');
 const action=useAction();
 const [open,setOpen]=useState(false),[document,setDocument]=useState<ServiceDocument>(()=>emptyServiceDocument()),[price,setPrice]=useState<number|''>(''),[saveCatalog,setSaveCatalog]=useState(false),[inspect,setInspect]=useState(false),[quantity,setQuantity]=useState(1),[allocation,setAllocation]=useState<Record<string,number>>({}),[reason,setReason]=useState('Customer Bargaining'),[wording,setWording]=useState<string|null>(null),[templateError,setTemplateError]=useState('');
 const products=useRepository('smart-service-products',()=>repositories.products.pos(),open),templates=useRepository('smart-service-templates',()=>repositories.services.list(),open);
 const searchSettings=useRepository('pos-search-settings',()=>repositories.settings.get(),open);
 const [pendingTemplate,setPendingTemplate]=useState<RepairService|null>(null);
 useEffect(()=>{const receive=(event:Event)=>{setPendingTemplate((event as CustomEvent<RepairService>).detail);setOpen(true);};window.addEventListener('taha-service-template',receive);return()=>window.removeEventListener('taha-service-template',receive);},[]);
 useEffect(()=>{
  if(!pendingTemplate||!products.data)return;
  const product=products.data.find(p=>p.id===pendingTemplate.linkedProductId);
  setTemplateError(product?'':'Saved material is unavailable. Choose a replacement before adding this service.');
  setDocument({before:'',mention:{productId:pendingTemplate.linkedProductId!,label:product?.name??'Unavailable material'},after:' '+(pendingTemplate.description||'service')});
  setPrice(product?product.sellingPrice+(pendingTemplate.defaultLaborCharge??0):pendingTemplate.sellingPrice);setWording(pendingTemplate.name);setQuantity(1);setAllocation({});setPendingTemplate(null);
 },[pendingTemplate,products.data]);
 const generated=composerText(document),name=wording??generated;
 const match=useMemo(()=>recognizeServiceMaterial(products.data??[],generated),[products.data,generated]),suggestions=useMemo(()=>suggestServiceTemplates(templates.data??[],generated),[templates.data,generated]);
 const selected=canConsume?products.data?.find(p=>p.id===document.mention?.productId):undefined;
 const places=useRepository('service-material-locations:'+(selected?.id??''),()=>repositories.services.materialLocations!(selected!.id),open&&!!selected&&!!repositories.services.materialLocations);
 const rows=places.data??[],values=rows.length===1?{[rows[0].locationId]:quantity}:allocation;
 const allocations=rows.map(row=>({locationId:row.locationId,quantity:values[row.locationId]??0})).filter(row=>row.quantity>0);
 const validAllocation=Number.isInteger(quantity)&&quantity>0&&allocations.reduce((n,a)=>n+a.quantity,0)===quantity&&allocations.every(a=>Number.isInteger(a.quantity)&&a.quantity<=rows.find(r=>r.locationId===a.locationId)!.quantity);
 const offline=useSyncStore(s=>s.status)==='OFFLINE'||!navigator.onLine,blocked=!!selected&&apiEnabled&&offline;
 const choose=(p:PosProduct)=>{
  const labels=[p.name,p.brand&&p.name.toLowerCase().startsWith(p.brand.toLowerCase()+' ')?p.name.slice(p.brand.length+1):''].filter(Boolean);
  const label=labels.find(value=>generated.toLowerCase().includes(value.toLowerCase()));
  const at=label?generated.toLowerCase().indexOf(label.toLowerCase()):-1;
  const work=at>=0?generated.slice(0,at)+generated.slice(at+label!.length):generated;
  setDocument(d=>({before:d.mention?d.before:'',mention:{productId:p.id,label:p.name},after:d.mention?d.after:' '+work.trim()}));
  if(!document.mention)setWording(generated);setQuantity(1);setAllocation({});setInspect(false);
 };
 const reset=()=>{setDocument(emptyServiceDocument());setPrice('');setSaveCatalog(false);setQuantity(1);setAllocation({});setInspect(false);setReason('Customer Bargaining');setWording(null);setTemplateError('');};
 const validPrice=price!==''&&Number.isFinite(price)&&price>0&&price<=999999999999.99&&Math.abs(price*100-Math.round(price*100))<=0.00001;
 if(!canCreate||(!localDemoEnabled&&!apiEnabled))return null;
 const add=()=>void action.run(async()=>{
  if(price===''||!validPrice)throw Error('Enter a customer charge above PKR 0 with no more than two decimal places.');
  if(document.mention&&!selected)throw Error('The linked product is unavailable. Remove or replace the mention.');
  if(selected&&!validAllocation)throw Error('Choose where the linked material will come from.');
  if(blocked)throw Error('Linked inventory services need the shop connection. Your description is retained.');
  if(selected&&price<selected.sellingPrice*quantity&&!reason.trim())throw Error('Enter the reason for charging below the normal product selling price.');
  if(saveCatalog&&(canCatalog||canManage))await repositories.services.save({id:crypto.randomUUID(),code:'',name:name.trim(),category:'Repair',sellingPrice:price,minimumSellingPrice:0,active:true,notes:'',description:document.after.trim(),...(selected?{linkedProductId:selected.id,pricingRule:'current-product-plus-labor' as const,defaultLaborCharge:Math.max(0,price-selected.sellingPrice*quantity)}:{})});
  const product:PosProduct={id:'custom:'+crypto.randomUUID(),internalCode:'Custom Service',name:name.trim(),category:'Services',brand:'',compatibleModel:selected?.name??'',qualityGrade:'Custom Service',color:'',quantity:0,sellingPrice:price,minimumSellingPrice:0,location:null,aliases:[],lowStockLevel:0,customService:{name:name.trim(),description:document.after.trim(),sellingPrice:price,minimumSellingPrice:0,...(selected?{material:{productId:selected.id,quantity,allocations,pricing:{sellingPrice:selected.sellingPrice,minimumSellingPrice:selected.minimumSellingPrice,reviewedAt:new Date().toISOString()}}}:{})}};
  useCartStore.getState().add(product);if(selected&&price<selected.sellingPrice*quantity)useCartStore.getState().updatePrice(product.id,price,reason);
 },saveCatalog?'Service saved and added to sale':'Service added to sale',()=>{setOpen(false);reset();requestAnimationFrame(()=>globalThis.document.querySelector<HTMLInputElement>('.pos-search input')?.focus());});
 return <><Button size="small" onClick={()=>setOpen(true)}><Plus size={15}/>Custom Service</Button><Dialog open={open} onOpenChange={setOpen} title="Add Custom Service" className="compound-service-dialog" description="Choose a part with @, describe the work and enter one final customer charge.">
  <Field label="Service name" wide><ServiceMentionComposer value={document} onChange={setDocument} products={products.data??[]} dictionary={searchSettings.data?.searchDictionary} canLink={canConsume} onSelectProduct={()=>{setWording(null);setTemplateError('');setQuantity(1);setAllocation({});setInspect(false);}} onRemoveProduct={()=>{setAllocation({});setInspect(false);}} onInspect={()=>setInspect(v=>!v)}/></Field>
  {products.isError&&<p role="alert">Cannot load the catalogue. <button type="button" className="text-link" onClick={()=>void products.refetch()}>Retry</button></p>}
  {suggestions.length>0&&!document.mention&&<div className="service-suggestions" aria-label="Saved service suggestions">{suggestions.map(s=><button type="button" key={s.id} aria-label={'Saved service: '+s.name} onClick={()=>{const product=products.data?.find(p=>p.id===s.linkedProductId);if(s.linkedProductId&&!product){setTemplateError('Saved material is unavailable. Review this service.');return;}setDocument(product?{before:'',mention:{productId:product.id,label:product.name},after:' '+(s.description||'service')}:emptyServiceDocument(s.name));setPrice(product?product.sellingPrice+(s.defaultLaborCharge??0):s.sellingPrice);setWording(s.name);setQuantity(1);setAllocation({});}}><Wrench size={14}/><span>{s.name}</span><span>{s.linkedProductId?'Current part + labor':currency(s.sellingPrice)}</span></button>)}</div>}
  {selected?<div className="service-material"><div className="linked-material-summary"><strong>Linked material: {selected.name} × {quantity} · {selected.quantity} available</strong><p>Normal selling price: {currency(selected.sellingPrice*quantity)}</p></div>
   {(inspect||rows.length>1)&&<ServiceMaterialAllocation product={selected} quantity={quantity} onQuantity={setQuantity} locations={rows} values={values} onAllocation={(id,n)=>setAllocation({...values,[id]:n})}/>}
   {rows.length===1&&!inspect&&<p className="service-hint">{quantity} from {rows[0].path??rows[0].locationId}</p>}
   {places.isPending&&<p role="status">Checking stock…</p>}{places.isError&&<p role="alert" className="text-danger">Cannot check material locations. <button type="button" onClick={()=>void places.refetch()}>Retry</button></p>}{!places.isPending&&!places.isError&&!rows.length&&<p role="alert" className="text-danger">No sellable stock is available for this part.</p>}
  </div>:<>{canConsume&&!document.mention&&!generated.includes('@')&&match.candidates.length>0&&<div className="service-match-options"><p>Choose the actual part to link it</p>{match.candidates.map(p=><button key={p.id} type="button" onClick={()=>choose(p)}>{p.name}<small>{[p.qualityGrade,p.color].filter(Boolean).join(' · ')} · {p.quantity} available</small></button>)}</div>}<p className="service-hint">{generated.includes('@')?'Select a product suggestion to link inventory. Unselected text consumes no stock.':'Service only · no inventory will be consumed.'}</p></>}
  <details className="service-wording"><summary>Customer-facing wording</summary><label className="form-field">Display name<input className="input" maxLength={120} value={wording??generated} onChange={e=>setWording(e.target.value)}/></label><button type="button" className="text-link" onClick={()=>setWording(null)}>Use product and service description</button></details>
  <Field label="Charge (PKR)" wide><CurrencyInput value={price} onChange={e=>setPrice(e.target.value===''?'':Number(e.target.value))}/></Field>
  {selected&&price!==''&&validPrice&&<><CompoundPriceBreakdown sellingPrice={selected.sellingPrice} charge={price} quantity={quantity} minimum={selected.minimumSellingPrice}/>{price<selected.sellingPrice*quantity&&<label className="form-field">Price reason<input className="input" value={reason} onChange={e=>setReason(e.target.value)}/></label>}{price<selected.minimumSellingPrice*quantity&&<p className="service-hint">After adding, use the cart pencil to request price approval. Checkout will enforce the current minimum.</p>}</>}
  {price===''&&<p className="service-hint">Enter the final customer charge. No price has been entered yet.</p>}{price!==''&&!validPrice&&<p role="alert" className="text-danger">Enter a charge above PKR 0 with no more than two decimal places. Blank and zero are different values.</p>}
  {(canCatalog||canManage)&&<label className="checkbox-field"><AppCheckbox checked={saveCatalog} onChange={e=>setSaveCatalog(e.target.checked)}/>Save as reusable service</label>}
  {blocked&&<p role="alert" className="text-danger">Linked inventory services require a shop connection.</p>}{(action.error||templateError)&&<p role="alert" className="text-danger">{action.error||templateError}</p>}
  <div className="dialog-actions"><Button disabled={action.busy} onClick={()=>setOpen(false)}>Cancel</Button><Button variant="primary" disabled={action.busy||!name.trim()||name.length>120||!validPrice||blocked||!!document.mention&&!selected||!!selected&&!validAllocation} onClick={add}><Wrench size={16}/>{action.busy?'Adding…':'Add to Sale'}</Button></div>
 </Dialog></>;
}
