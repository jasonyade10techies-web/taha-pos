import type { ServiceMaterial } from '../../types/product';
import type { SaleLine } from '../../types/demo';
import { demoDb, requireValue, money } from './database';
import { authorize, move, audit, actor } from './common';

/** Called only inside the sale's existing IndexedDB transaction. */
export async function consumeServiceMaterial(material: ServiceMaterial, line: SaleLine, invoice: string, taxMode?:string) {
  authorize('services.consume_inventory');
  const product=await demoDb.products.get(material.productId);
  requireValue(product?.state==='active'&&product.category!=='Services','Select an active physical part.');
  requireValue(!(await demoDb.devices.where('productId').equals(material.productId).count()),'An individually tracked device cannot be used as a service material.');
  const total=material.quantity*line.quantity;
  requireValue(Number.isInteger(material.quantity)&&material.quantity>0&&total<=999999,'Material quantity must be a positive whole number.');
  if(material.pricing){
    requireValue(Number.isFinite(Date.parse(material.pricing.reviewedAt)),'Review the current linked product price.');
    requireValue(material.pricing.sellingPrice===product.sellingPrice&&material.pricing.minimumSellingPrice===product.minimumSellingPrice,'Material price or minimum price changed; explicitly review the current linked product before checkout.');
  }
  const settings=await demoDb.settings.get('main');requireValue(settings,'Settings unavailable.');
  const basis=money(product.sellingPrice*total),minimum=money(product.minimumSellingPrice*total);
  const accepted=money(line.total-(taxMode==='Exclusive'?(line.taxAmount??0):0));
  if(line.unitPrice<product.sellingPrice*material.quantity){
    authorize('pricing.discount_within_range');requireValue(settings.bargaining&&line.reason?.trim(),'Product discount needs bargaining enabled and a reason.');
  }
  if(accepted<minimum){
    requireValue(settings.belowMinimum!=='Block','Below-minimum material pricing is blocked.');
    requireValue(!line.discount,'Coupon would violate the linked product minimum floor.');
    if(settings.belowMinimum==='Manager Approval'){
      const manager=line.approval?await demoDb.employees.get(line.approval.managerId):undefined;
      requireValue(manager?.status==='active'&&(manager.role==='owner'||manager.permissions.includes('pricing.override_minimum'))&&line.approval?.price===line.unitPrice/material.quantity&&line.approval.employeeId===actor().id,'A demo manager approval is required for the linked product minimum price.');
    }else requireValue(line.reason?.trim(),'A reason is required below the linked product minimum.');
  }
  const productGross=Math.min(accepted,basis),laborGross=money(accepted-productGross),productTax=accepted?Math.min(line.taxAmount??0,money((line.taxAmount??0)*productGross/accepted)):0,laborTax=money((line.taxAmount??0)-productTax);
  line.compound={productSellingBasis:basis,productMinimumBasis:minimum,productRevenue:money(productGross-(taxMode==='Exclusive'?0:productTax)),laborRevenue:money(laborGross-(taxMode==='Exclusive'?0:laborTax)),productDiscount:money(basis-productGross),productTax,laborTax,productTotal:money(productGross+(taxMode==='Exclusive'?productTax:0)),laborTotal:money(laborGross+(taxMode==='Exclusive'?laborTax:0))};
  requireValue(Array.isArray(material.allocations)&&material.allocations.length>0&&material.allocations.length<=100,'Choose the material stock locations.');
  requireValue(new Set(material.allocations.map(a=>a.locationId)).size===material.allocations.length,'Do not select the same material location twice.');
  requireValue(material.allocations.reduce((sum,a)=>sum+a.quantity,0)===material.quantity,'Material allocations must equal the quantity per service.');
  const locations=await demoDb.locations.toArray();
  for (const allocation of material.allocations) {
    requireValue(Number.isInteger(allocation.quantity)&&allocation.quantity>0,'Allocate positive whole quantities.');
    const box=locations.find(l=>l.id===allocation.locationId),shelf=locations.find(l=>l.id===box?.parentId),rack=locations.find(l=>l.id===shelf?.parentId);
    requireValue((box?.stockCondition??'Available')==='Available','Damaged / Quarantine stock cannot be consumed by a service.');
    requireValue(box?.kind==='box'&&!box.archived&&shelf?.kind==='shelf'&&!shelf.archived&&rack?.kind==='rack'&&!rack.archived,'Choose an active Rack → Shelf → Box location.');
    const balance=await demoDb.balances.get(material.productId+':'+allocation.locationId);
    requireValue((balance?.quantity??0)>=allocation.quantity*line.quantity,'This service cannot be completed because the selected box has insufficient stock.');
  }
  for (const allocation of material.allocations) await move(material.productId,allocation.locationId,-allocation.quantity*line.quantity,'REPAIR_USE',invoice,'Material for '+line.name);
  line.material={productId:product.id,name:product.name,variant:product.variant,quantity:total,quantityPerService:material.quantity,allocations:material.allocations.map(a=>({...a,quantity:a.quantity*line.quantity}))};
  await audit('service.material_consumed','Inventory',total+' '+product.name+' consumed for '+line.name,invoice);
  const financial=await demoDb.financials.get(product.id);
  return financial&&Number.isFinite(financial.cost) ? money(financial.cost*total) : null;
}
