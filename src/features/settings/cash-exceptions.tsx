import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {cashRecords,cashStateLabel,resolveCash,type CashRecord} from '../../lib/desktop/reconciliation';
import {useSessionStore} from '../../stores/session-store';
import {usePermission} from '../../hooks/use-permission';
import {useAction} from '../../hooks/use-repository';
import {Button} from '../../components/ui/button';
import {Dialog} from '../../components/ui/dialog';
import {DataTable} from '../../components/ui/workspace';
import {currency} from '../../lib/utils';
import {apiEnabled} from '../../lib/config';
import {nativeDesktop} from '../../lib/desktop/runtime';
const cashAmount=(value:number|null)=>value==null?'Amount needs review':currency(Number(value));
export function CashExceptions(){
 const profile=useSessionStore(s=>s.profile),store=useSessionStore(s=>s.context?.store?.id);
 const allowed=usePermission('sync.reconcile_cash')&&['owner','manager'].includes(profile?.role??'');
 const query=useQuery({queryKey:['cash-exceptions',profile?.id,store],queryFn:cashRecords,enabled:allowed&&(nativeDesktop||apiEnabled),refetchInterval:15000});
 const [selected,setSelected]=useState<CashRecord|null>(null),[reason,setReason]=useState(''),[confirmRefund,setConfirmRefund]=useState(false),[history,setHistory]=useState(false);
 const action=useAction();
 if(!allowed)return <p className="text-muted">Financial exceptions can be resolved by the owner or an authorized manager.</p>;
 if(!nativeDesktop&&!apiEnabled)return <p className="text-muted">Synchronization exceptions are available with shop transactions and the installed Windows counter. Demo transactions remain in this browser.</p>;
 const rows=query.data?.rows??[],pending=rows.filter(r=>!['POSTED','REFUNDED'].includes(r.state)),unknown=pending.filter(r=>r.collected==null).length;
 const record=rows.find(r=>r.id===selected?.id)??selected,receipt=record?.payload.receipt;
 const run=(kind:'retry'|'refund')=>record&&void action.run(()=>resolveCash(record,kind,reason),'Cash decision recorded',()=>{setSelected(null);setReason('');setConfirmRefund(false);void query.refetch();});
 return <div className="space-y-4">
  <div className="flex items-center justify-between gap-3"><div><h3>Synchronization Exceptions</h3><p className="text-sm text-muted">{pending.length} receipts need attention · {unknown?'Known collected':'Collected'} {currency(pending.reduce((s,r)=>s+Number(r.collected||0),0))}</p>{unknown>0&&<p className="text-sm text-muted">{unknown} {unknown===1?'receipt needs its':'receipts need their'} cash amount reviewed.</p>}</div><Button size="small" variant="secondary" onClick={()=>{setHistory(!history);}}> {history?'Show Unresolved':'Recent Resolutions'}</Button></div>
  <p className="text-sm text-muted">Cash already received is retained separately from posted sales. Resolve stock through an authorized inventory operation before retrying.</p>
  {query.isPending&&<p role="status">Loading collected cash…</p>}
  {query.isError&&<p role="alert">Cash records could not be loaded. Local receipts are retained. <Button size="small" onClick={()=>void query.refetch()}>Retry</Button></p>}
  {query.data&&!query.data.serverAvailable&&<p role="alert" className="auth-notice">Showing retained Windows receipts. Connect to the shop to verify and record a decision.</p>}
  {query.data&&<DataTable rows={history?rows:pending} emptyTitle="No synchronization exceptions" columns={[
   {label:'Invoice',render:r=><strong className="break-all">{r.invoice}</strong>},
   {label:'Employee',render:r=>r.seller_name||r.seller_id||'Original receipt requires review'},
   {label:'Collected',render:r=>cashAmount(r.collected)},
   {label:'Date',render:r=>new Date(r.captured_at).toLocaleString('en-GB',{timeZone:'Asia/Karachi'})},
   {label:'Problem / Status',render:r=><><span>{cashStateLabel(r.state)}</span><small className="block text-muted">{r.reason||'Cash receipt retained'}</small></>},
   {label:'Action',render:r=><Button size="small" variant="secondary" onClick={()=>{setSelected(r);setReason('');setConfirmRefund(false);}}>Inspect</Button>},
  ]}/>}
  <Dialog open={!!record} onOpenChange={open=>{if(!open&&!action.busy)setSelected(null);}} title="Cash Reconciliation" description="Preserve the original receipt and record an independently authorized decision.">
   {record&&<div className="space-y-4"><strong className="break-all">{record.invoice}</strong>
    <dl className="sync-summary"><dt>Original seller</dt><dd>{record.seller_name}</dd><dt>Captured</dt><dd>{new Date(record.captured_at).toLocaleString('en-GB',{timeZone:'Asia/Karachi'})}</dd><dt>Terminal</dt><dd className="break-all">{record.terminal_id||'See original receipt'}</dd><dt>Customer</dt><dd>{receipt?.customerName||record.payload.input.customerId||'Walk-in Customer'}</dd><dt>Cash received</dt><dd>{cashAmount(record.tendered)}</dd><dt>Change given</dt><dd>{cashAmount(record.change_given)}</dd><dt>Collected</dt><dd>{cashAmount(record.collected)}</dd><dt>Status</dt><dd>{cashStateLabel(record.state)}</dd></dl>
    <div className="auth-notice"><strong>Cash drawer implications</strong><p>This money belongs to the original seller’s collection. It is not posted sales revenue until accepted. A full exception refund is recorded as cash paid out by the resolving staff member, with no inventory movement.</p></div>
    <div>{receipt?.lines?.map((line,i)=><div className="flex justify-between gap-3 py-2" key={i}><span>{line.name} × {line.quantity}</span><strong>{currency(line.unitPrice*line.quantity)}</strong></div>)??record.payload.input.lines.map((line,i)=><p key={i}>{line.productId} × {line.quantity} · {currency(line.unitPrice)}</p>)}</div>
    <p className="text-sm text-muted">Original receipt total {cashAmount(receipt?.total??record.collected)}. Tax {currency(Number(receipt?.tax?.amount??0))}. Receipt snapshots are retained even after server posting.</p>
    {record.reason&&<p role="status" className="auth-notice">Shop response: {record.reason}</p>}
    {record.resolver_id&&<p className="text-sm text-muted">Decision by {record.resolver_id}</p>}
    <Link className="button button-secondary" to="/inventory">Review Stock</Link>
    {!['POSTED','REFUNDED'].includes(record.state)&&<><label className="form-field">Decision reason<textarea className="input" aria-label="Decision reason" value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>
     <p className="text-sm text-muted">Linked replacements and amendments are not supported. Retry the same invoice after resolving the issue, or confirm an actual full cash refund.</p>
     {confirmRefund&&<p role="alert" className="auth-notice">Confirm that {cashAmount(record.collected)} has actually been returned to this customer. This closes the exception and cannot be undone here.</p>}
     <div className="flex flex-wrap gap-2"><Button disabled={action.busy||reason.trim().length<5||!apiEnabled} onClick={()=>run('retry')}>Retry Original Receipt</Button><Button variant="secondary" disabled={action.busy||reason.trim().length<5||!apiEnabled||!Number(record.collected)} onClick={()=>confirmRefund?run('refund'):setConfirmRefund(true)}>{confirmRefund?'Confirm Cash Returned':'Record Actual Refund'}</Button></div>
    </>}
    {action.error&&<p role="alert" className="text-danger">{action.error}</p>}
   </div>}
  </Dialog>
 </div>;
}
