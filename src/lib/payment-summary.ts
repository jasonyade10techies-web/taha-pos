import type {PaymentAllocation,PaymentMethod,Sale} from '../types/demo';
/** Presentation only: refunds/reversals remain distinct records in invoice detail. */
export function paymentSummary(payments:PaymentAllocation[],methods:PaymentMethod[]=[]) {
 const incoming=payments.filter(p=>(!p.status||p.status==='Confirmed')&&p.kind!=='refund'&&p.kind!=='reversal');
 const groups=new Map<string,string>();
 for(const p of incoming)groups.set(p.methodId,p.methodName??methods.find(m=>m.id===p.methodId)?.name??p.methodId);
 return [...groups.values()].join(' + ')||'Credit';
}
/** Incoming money, refunds and reversals are separate historical events. */
export function receiptPayments(sale:Pick<Sale,'payments'|'paid'|'outstanding'|'total'>){
 const recorded=sale.payments.filter(p=>p.status!=='Pending'&&p.status!=='Rejected'&&p.methodKind!=='Credit'&&p.methodId!=='credit');
 const sum=(kind:'incoming'|'refund'|'reversal')=>Math.round(recorded.filter(p=>kind==='incoming'?p.kind!=='refund'&&p.kind!=='reversal':p.kind===kind).reduce((n,p)=>n+p.amount,0)*100)/100;
 const received=sum('incoming'),refunded=sum('refund'),reversed=sum('reversal'),paid=sale.paid??Math.max(0,received-refunded-reversed);
 return {received,refunded,reversed,paid,outstanding:sale.outstanding??Math.max(0,sale.total-paid)};
}
