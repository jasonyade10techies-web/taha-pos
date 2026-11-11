import {normalizeWhatsapp} from '../../lib/reminders';
import {useState} from 'react';
import {Download,Copy,Share2,MessageCircle} from 'lucide-react';
import type {Sale} from '../../types/demo';
import {Dialog} from '../ui/dialog';
import {Button} from '../ui/button';
import {downloadInvoicePdf,createInvoicePdf} from '../../lib/invoice-pdf';
import {toast} from '../../stores/toast-store';
export function VirtualReceipt({sale,phone:initialPhone=''}:{sale:Sale;phone?:string}){
 const [open,setOpen]=useState(false),[phone,setPhone]=useState(initialPhone),[busy,setBusy]=useState(false);
 const execute=async(action:()=>Promise<unknown>)=>{setBusy(true);try{await action();}catch(error){toast(error instanceof Error?error.message:'Could not share this receipt.','error');}finally{setBusy(false);}};
 const text=`Thank you for shopping at Taha Mobiles. Your receipt: ${sale.receiptUrl}`;
 return <><Button onClick={()=>{setPhone(old=>old||initialPhone);setOpen(true);}}><Share2 size={16}/>Virtual Receipt</Button><Dialog open={open} onOpenChange={setOpen} title="Send Virtual Receipt" description={`${sale.invoice} · download or share a copy with the customer.`}><label className="form-field">Customer phone (optional)<input className="input" inputMode="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="03XX XXXXXXX"/><small>A phone number is optional for normal cash sales.</small></label><div className="virtual-receipt-actions"><Button disabled={busy} onClick={()=>void execute(()=>downloadInvoicePdf(sale))}><Download size={16}/>Download PDF</Button><Button disabled={!sale.receiptUrl||busy} onClick={()=>void execute(async()=>{await navigator.clipboard.writeText(sale.receiptUrl!);toast('Receipt link copied');})}><Copy size={16}/>Copy Receipt Link</Button><Button disabled={!sale.receiptUrl} onClick={()=>{const number=normalizeWhatsapp(phone);if(phone.trim()&&!number){toast('Enter a valid customer phone number.','error');return;}window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');}}><MessageCircle size={16}/>Open WhatsApp</Button>{!!navigator.share&&<Button disabled={busy} onClick={()=>void execute(async()=>{const pdf=await createInvoicePdf(sale),file=new File([pdf.output('blob')],`${sale.invoice}.pdf`,{type:'application/pdf'});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:sale.invoice});else if(sale.receiptUrl)await navigator.share({title:sale.invoice,text,url:sale.receiptUrl});else throw new Error('Download the PDF to share it from your phone.');})}><Share2 size={16}/>Share on Phone</Button>}</div>{!sale.receiptUrl&&<p className="auth-notice">Download the PDF for this local receipt. A secure receipt link is available after the sale is recorded in the shared shop.</p>}<p className="text-xs text-muted">WhatsApp opens with a receipt link. Attach the downloaded PDF manually if needed.</p></Dialog></>;
}

