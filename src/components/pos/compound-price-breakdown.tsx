import {compoundAllocation} from '../../lib/compound-service';
import {currency} from '../../lib/utils';
export function CompoundPriceBreakdown({sellingPrice,charge,quantity=1,minimum=0}:{sellingPrice:number;charge:number;quantity?:number;minimum?:number}){
 const split=compoundAllocation(sellingPrice,charge,quantity);
 return <div className="compound-price-breakdown" aria-label="Combined charge breakdown">
  <div><span>Product portion</span><strong data-testid="product-portion">{currency(split.product)}</strong></div>
  <div><span>Service / labor</span><strong data-testid="labor-portion">{currency(split.labor)}</strong></div>
  {split.discount>0&&<><p className="compound-price-warning" role="status">Normal product selling price is {currency(split.basis)}. Your combined charge is {currency(split.discount)} lower.</p><div><span>Discount against product basis</span><strong>{currency(split.discount)}</strong></div></>}
  {charge<minimum*quantity&&<p role="alert" className="text-danger">Below minimum allowed {currency(minimum*quantity)}. Authorized price review is required.</p>}
  <small>Per service unit. Labor is revenue; acquisition cost and profit are accounted for separately.</small>
 </div>;
}
