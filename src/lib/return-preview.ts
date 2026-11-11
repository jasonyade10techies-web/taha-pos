import type {Sale,ReturnRecord} from '../types/demo';
const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
/** Mirrors the established cumulative SQL allocation; never authorizes a return. */
export function returnPreview(sale:Sale,history:ReturnRecord[],productId:string,quantity:number,refundLabor=false){
 const line=sale.lines.find(item=>item.productId===productId);
 if(!line||!Number.isInteger(quantity)||quantity<1)return null;
 const previous=sale.returned[productId]??0;
 if(previous+quantity>line.quantity)return null;
 const part=(total:number)=>round(total*(previous+quantity)/line.quantity)-round(total*previous/line.quantity);
 const amount=round(line.compound?part(line.compound.productTotal)+(refundLabor?part(line.compound.laborTotal):0)
  :previous+quantity===line.quantity?line.total-history.filter(row=>row.saleId===sale.id&&row.productId===productId).reduce((n,row)=>n+row.amount,0)
  :round(line.total*quantity/line.quantity));
 const outstanding=Math.max(0,sale.outstanding??Math.max(0,sale.total-(sale.paid??sale.total)));
 const creditReduction=round(Math.min(amount,outstanding)),manualRefund=round(amount-creditReduction);
 return {amount,creditReduction,manualRefund,before:round(outstanding),after:round(outstanding-creditReduction),previous,remaining:line.quantity-previous-quantity};
}
