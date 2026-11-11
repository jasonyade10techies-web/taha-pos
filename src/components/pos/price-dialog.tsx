import {Field} from '../ui/workspace';
import { AppSelect } from '../ui/app-select';
import { useState } from "react";
import { ShieldAlert, CircleCheck, Info } from "lucide-react";
import type { CartItem } from "../../types/product";
import { useCartStore } from "../../stores/cart-store";
import { currency } from "../../lib/utils";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { usePermission } from "../../hooks/use-permission";
import { useRepository, useAction } from "../../hooks/use-repository";
import { repositories } from "../../lib/repositories";
import { demoApprovalService } from "../../lib/local/demo-approval-service";
import { localDemoEnabled } from "../../lib/config";
import {transactionApprovalService} from "../../lib/supabase/approval-service";
import {useSessionStore} from "../../stores/session-store";
import { InfoTooltip } from "../ui/info-tooltip";
import {CompoundPriceBreakdown} from './compound-price-breakdown';
import {materialPriceChanged} from '../../lib/compound-service';
const reasons = [
  "Customer Bargaining",
  "Trade Customer",
  "Damaged Packaging",
  "Promotion",
  "Other",
];
export function PriceDialog(props: { item: CartItem; onClose: () => void }) {
  return props.item.product.customService ? <CustomServicePriceDialog {...props}/> : <NegotiatedPriceDialog {...props}/>;
}
function CustomServicePriceDialog({item,onClose}: {item:CartItem;onClose:()=>void}) {
 const [price,setPrice]=useState(String(item.unitPrice)),[reason,setReason]=useState(item.priceReason??'Customer Bargaining'),[manager,setManager]=useState(''),[pin,setPin]=useState(''),[reviewed,setReviewed]=useState('');
 const canCharge=usePermission('services.create_custom'),canDiscount=usePermission('pricing.discount_within_range'),action=useAction();
 const material=item.product.customService?.material;
 const q=useRepository('compound-service-price:'+item.product.id,async()=>({products:material?await repositories.products.pos():[],settings:await repositories.settings.get(),managers:localDemoEnabled?await repositories.employees.list():(await transactionApprovalService.list('pricing.override_minimum')).map(e=>({...e,status:'active',role:'manager',permissions:['pricing.override_minimum']}))}));
 const product=q.data?.products.find(p=>p.id===material?.productId),changed=!!material&&!!q.data&&materialPriceChanged(material,product);
 const selling=product?.sellingPrice??material?.pricing?.sellingPrice??0,minimum=product?.minimumSellingPrice??material?.pricing?.minimumSellingPrice??0,units=material?.quantity??1,value=Number(price),below=!!material&&value<minimum*units,discount=!!material&&value<selling*units;
 const basis=selling+':'+minimum,stale=changed&&reviewed!==basis;
 const blocked=below&&q.data?.settings.belowMinimum==='Block',needsApproval=below&&q.data?.settings.belowMinimum==='Manager Approval',invalid=!price.trim()||!Number.isFinite(value)||value<=0;
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}} title="Service price" description={item.product.name} className="compound-service-dialog">
  {q.isError&&<p role="alert" className="text-danger">Could not check current price and policy. <button onClick={()=>void q.refetch()}>Retry</button></p>}
  <form onSubmit={e=>{e.preventDefault();if(invalid||blocked||!canCharge||stale||!!material&&!product||discount&&!canDiscount)return;void action.run(async()=>{
   let approval;
   if(needsApproval){const who=manager||q.data?.managers[0]?.id;if(!who)throw Error('No authorized price approver is available.');approval=localDemoEnabled?await demoApprovalService.approve(who,pin,selling*units,value,reason):await(async()=>{const result=await transactionApprovalService.approve(who,pin,'price',{cartId:useCartStore.getState().cartId,productId:material!.productId,price:Math.round(value/units*100)/100,reason});return {token:result.token,expiresAt:result.expiresAt,managerId:result.managerId!,managerName:result.managerName!,reason,original:selling*units,price:value,employeeId:useSessionStore.getState().employee.id,createdAt:new Date().toISOString()};})();}
   if(material&&product)useCartStore.getState().reviewServiceMaterial(item.product.id,{...material,pricing:{sellingPrice:product.sellingPrice,minimumSellingPrice:product.minimumSellingPrice,reviewedAt:new Date().toISOString()}});
   useCartStore.getState().updatePrice(item.product.id,value,reason,approval);
  },'Service price reviewed',onClose);}}>
   <label className="field-label" htmlFor="service-price">{material?'Combined customer charge':'Price (PKR)'}</label><div className="currency-input"><span>PKR</span><input id="service-price" type="number" inputMode="decimal" min="0.01" step="0.01" autoFocus value={price} onChange={e=>setPrice(e.target.value)}/></div>
   {material&&<><CompoundPriceBreakdown sellingPrice={selling} charge={value} quantity={units} minimum={minimum}/>{changed&&<div className="service-price-review" role="alert"><strong>The linked product price changed. Review the current allocation.</strong><span>Normal {currency(selling*units)} · Minimum {currency(minimum*units)}</span><Button disabled={!product} onClick={()=>setReviewed(basis)}>{reviewed===basis?'Current price reviewed':'Use reviewed current price'}</Button></div>}{!q.isPending&&!product&&<p role="alert" className="text-danger">Linked product is unavailable. Replace this service line before checkout.</p>}{discount&&<label className="form-field">Price reason<input className="input" value={reason} onChange={e=>setReason(e.target.value)} required/></label>}{blocked&&<p role="alert" className="text-danger">Below-minimum pricing is blocked by shop policy.</p>}{needsApproval&&<div className="auth-notice"><strong>Authorized override required</strong><Field label="Approving manager"><AppSelect value={manager||q.data?.managers[0]?.id||''} onChange={e=>setManager(e.target.value)}>{q.data?.managers.filter(m=>m.status==='active'&&(m.role==='owner'||m.permissions.includes('pricing.override_minimum'))).map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</AppSelect></Field><label className="form-field">Manager PIN<input className="input" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))}/></label></div>}</>}
   <p className="service-hint">Unit charge {currency(value||0)} · Quantity {item.quantity} · Line total {currency((value||0)*item.quantity)}. Linked SKU and material units are preserved.</p>
   {action.error&&<p role="alert" className="text-danger">{action.error}</p>}
   <div className="dialog-actions"><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" disabled={action.busy||q.isPending||q.isError||!canCharge||invalid||blocked||stale||!!material&&!product||discount&&(!canDiscount||!reason.trim())}>Apply price</Button></div>
  </form>
 </Dialog>;
}
function NegotiatedPriceDialog({
  item,
  onClose,
}: {
  item: CartItem;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(String(item.unitPrice));
  const [reason, setReason] = useState(item.priceReason ?? reasons[0]);
  const [manager, setManager] = useState("manager-1");
  const [pin, setPin] = useState("");
  const update = useCartStore((s) => s.updatePrice);
  const canDiscount = usePermission("pricing.discount_within_range");
  const q = useRepository("price-approval", async () => ({
    settings: await repositories.settings.get(),
    employees: localDemoEnabled ? await repositories.employees.list() : (await transactionApprovalService.list("pricing.override_minimum")).map(e=>({...e,status:"active",role:"manager",permissions:["pricing.override_minimum"]})),
  }));
  const a = useAction();
  const value = Number(price);
  const invalid = !price.trim() || !Number.isFinite(value) || value <= 0;
  const below = !invalid && value < item.product.minimumSellingPrice;
  const above = value > item.product.sellingPrice;
  const approval =
    below && q.data?.settings.belowMinimum === "Manager Approval";
  const blocked = below && q.data?.settings.belowMinimum === "Block";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Adjust selling price"
      description={item.product.name}
    >
      <div className="price-reference">
        <div>
          <span>Listed Price</span>
          <strong>{currency(item.product.sellingPrice)}</strong>
        </div>
        <div>
          <span>Minimum Allowed <InfoTooltip label="Lowest price an employee may use without manager approval." /></span>
          <strong>{currency(item.product.minimumSellingPrice)}</strong>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid || above || blocked || !canDiscount) return;
          void a.run(
            async () => {
              const approved = approval
                ? localDemoEnabled ? await demoApprovalService.approve(
                    manager,
                    pin,
                    item.product.sellingPrice,
                    value,
                    reason,
                  ) : await (async()=>{
                    const result=await transactionApprovalService.approve(q.data?.employees.some(e=>e.id===manager)?manager:q.data!.employees[0].id,pin,"price",{cartId:useCartStore.getState().cartId,productId:item.product.id,price:value,reason});
                    return {token:result.token,expiresAt:result.expiresAt,managerId:result.managerId!,managerName:result.managerName!,reason,original:item.product.sellingPrice,price:value,employeeId:useSessionStore.getState().employee.id,createdAt:new Date().toISOString()};
                  })()
                : undefined;
              update(item.product.id, value, reason, approved);
            },
            "Price adjusted",
            onClose,
          );
        }}
      >
        <label className="field-label" htmlFor="new-price">
          New Price <span>per unit</span>
        </label>
        <div className="currency-input">
          <span>PKR</span>
          <input
            id="new-price"
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <label className="field-label mt-5" htmlFor="price-reason-trigger">
          Reason
        </label>
        <AppSelect
          className="input"
          id="price-reason"
          aria-label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {reasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </AppSelect>
        <div
          className={
            "price-status " +
            (invalid || above ? "neutral" : below ? "warning" : "success")
          }
          role="status"
        >
          {below ? (
            <ShieldAlert size={20} />
          ) : invalid || above ? (
            <Info size={20} />
          ) : (
            <CircleCheck size={20} />
          )}
          <div>
            <strong>
              {invalid
                ? "Enter a valid price"
                : above
                  ? "Price exceeds listed price"
                  : blocked
                    ? "Below-minimum pricing blocked"
                    : below
                      ? "Manager Approval Required"
                      : "Within allowed range"}
            </strong>
            <p>
              {below
                ? "A reason and the configured approval policy apply."
                : "Negotiated changes remain attached to the invoice."}
            </p>
          </div>
        </div>
        {approval && (
          <div className="auth-notice">
            <strong>{localDemoEnabled ? "DEMO APPROVAL SERVICE" : "SECURE MANAGER APPROVAL"}</strong>
            <p>
              {localDemoEnabled ? "Prototype only. Public demo PIN: 123456. This is not production authentication." : "The server verifies the manager PIN and issues a single-use approval for this price, seller and cart. Expires after five minutes."}
            </p>
            <Field label="Approving manager"><AppSelect
                className="input"
                value={q.data?.employees.some(e=>e.id===manager)?manager:q.data?.employees[0]?.id ?? ""}
                onChange={(e) => setManager(e.target.value)}
              >
                {q.data?.employees
                  .filter(
                    (e) =>
                      e.status === "active" &&
                      (e.role === "owner" ||
                        e.permissions.includes("pricing.override_minimum")),
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name}
                    </option>
                  ))}
              </AppSelect></Field>
            <label className="form-field mt-3">
              {localDemoEnabled ? "Manager demo PIN" : "Manager PIN"}
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </div>
        )}
        {a.error && (
          <p role="alert" className="text-danger">
            {a.error}
          </p>
        )}
        <div className="dialog-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={
              invalid ||
              above ||
              blocked ||
              !canDiscount ||
              !q.data?.settings.bargaining ||
              a.busy ||
              (approval && pin.length !== 6)
            }
          >
            {approval ? "Approve & Apply" : "Apply price"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
