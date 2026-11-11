import type {Sale} from '../types/demo';
import {currency} from './utils';
import {receiptPayments} from './payment-summary';
export function receiptCopyText(sale:Sale,format:'receipt'|'invoice'='receipt'){
 const money=receiptPayments(sale);
 return ['TAHA MOBILES',`${format==='invoice'?'Invoice':'Receipt'}: ${sale.invoice}`,
  ...sale.lines.map(line=>`${line.quantity} × ${line.name} — ${currency(line.total)}`),
  `Total: ${currency(sale.total)}`,`Paid: ${currency(money.paid)}`,
  ...(money.refunded?[`Refunds: ${currency(money.refunded)}`]:[]),
  `Outstanding: ${currency(money.outstanding)}`,
  ...(sale.receiptUrl?[`Receipt: ${sale.receiptUrl}`]:[]),'Thank you for shopping at Taha Mobiles.'].join('\n');
}
