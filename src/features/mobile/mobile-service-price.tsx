import {useState} from 'react';
import type {CartItem,PosProduct} from '../../types/product';
import {Dialog} from '../../components/ui/dialog';
import {Button} from '../../components/ui/button';
import {CompoundPriceBreakdown} from '../../components/pos/compound-price-breakdown';
import {materialPriceChanged} from '../../lib/compound-service';
import {staffService} from '../../lib/mobile/staff-service';
export function MobileServicePrice({item,products,onClose,onSave}:{item:CartItem;products:PosProduct[];onClose:()=>void;onSave:(item:CartItem)=>void}){
 const [price,setPrice]=useState(String(item.unitPrice)),[reason,setReason]=useState(item.priceReason??'Customer Bargaining'),[reviewed,setReviewed]=useState('');
 const material=item.product.customService?.material,current=products.find(p=>p.id===material?.productId),units=material?.quantity??1,value=Number(price),changed=!!material&&materialPriceChanged(material,current);
 const floor=(current?.minimumSellingPrice??0)*units,discount=!!current&&value<current.sellingPrice*units;
 const basis=current?.sellingPrice+':'+current?.minimumSellingPrice;
 const blocked=!staffService.allow('services.create_custom')||!price.trim()||!Number.isFinite(value)||value<=0||!!material&&(!current||value<floor||changed&&reviewed!==basis)||discount&&(!staffService.allow('pricing.discount_within_range')||!reason.trim());
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}} title="Service price" description={item.product.name} className="bottom-sheet mobile-service-sheet">
  <label className="form-field">{material?'Combined customer charge':'Price (PKR)'}<input className="input" type="number" inputMode="decimal" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label>
  {current&&<CompoundPriceBreakdown sellingPrice={current.sellingPrice} minimum={current.minimumSellingPrice} charge={value} quantity={units}/>}
  {changed&&current&&<div className="auth-notice"><p>The linked product price changed. Review the current allocation before applying.</p><Button onClick={()=>setReviewed(basis)}>{reviewed===basis?'Current price reviewed':'Use reviewed current price'}</Button></div>}
  {discount&&<label className="form-field">Price reason<input className="input" value={reason} onChange={e=>setReason(e.target.value)}/></label>}
  {!!material&&!current&&<p role="alert">The linked part is unavailable. Replace this service line before checkout.</p>}
  {!!material&&value<floor&&<p role="alert">This price needs an authorized override at the counter. It cannot be approved on this screen.</p>}
  <p className="mobile-sale-note">Unit charge × {item.quantity}. The linked part and quantity are retained. Checkout verifies current stock and price.</p>
  <div className="dialog-actions"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={blocked} onClick={()=>{onSave({...item,unitPrice:Math.round(value*100)/100,priceReason:reason,approval:undefined,product:{...item.product,customService:{...item.product.customService!,...(material&&current?{material:{...material,pricing:{sellingPrice:current.sellingPrice,minimumSellingPrice:current.minimumSellingPrice,reviewedAt:new Date().toISOString()}}}:{})}}});onClose();}}>Apply price</Button></div>
 </Dialog>;
}
