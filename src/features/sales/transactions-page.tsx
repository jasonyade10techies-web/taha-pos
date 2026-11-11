import {DatePicker} from "../../components/ui/date-picker";
import {useShopConfiguration} from "../../hooks/use-shop-configuration";
import {paymentSummary} from "../../lib/payment-summary";
import "./workflow-corrections.css";
import {receiptPrinter} from '../../lib/receipt-printer';
import {downloadInvoicePdf} from '../../lib/invoice-pdf';
import {VirtualReceipt} from '../../components/pos/virtual-receipt';
import { AppSelect } from '../../components/ui/app-select';
import {MediaImage} from '../../components/media/media-image';
import { demoApprovalService } from "../../lib/local/demo-approval-service";
import { Dialog } from "../../components/ui/dialog";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  DataTable,
  QueryState,
  SearchInput,
  FilterBar,
  StatusBadge,
  ConfirmDialog,
  RecordForm,
  type FormField,
  Tabs,
} from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { ReceiptPreview } from "../../components/pos/receipt-preview";
import { currency } from "../../lib/utils";
import { num, text, options, stamp } from "../shared/format";
import type { ReturnRecord } from "../../types/demo";
import { usePermission } from "../../hooks/use-permission";
import {localDemoEnabled} from "../../lib/config";
import {transactionApprovalService} from "../../lib/supabase/approval-service";
import {proofUrl} from "../../lib/supabase/business-assets";
import {ReceiptLookup} from '../../components/pos/receipt-lookup';
import type {Sale} from '../../types/demo';

export function TransactionsPage() {
  const navigate=useNavigate(),{ownerOnly}=useShopConfiguration();
  const [params,setParams]=useSearchParams();
  const search=params.get('search')??'',status=params.get('status')??'';
  const exactDate = params.get('date') ?? '';
  const from=params.get('from')??exactDate,to=params.get('to')??exactDate;
  const employee=params.get('employee')??'',customer=params.get('customer')??'',payment=params.get('method')??'';
  const page=Math.max(0,Number(params.get('page'))||0);
  const updateFilter=(key:string,value:string)=>setParams(previous=>{
    const next=new URLSearchParams(previous);
    if(next.has('date')){next.set('from',exactDate);next.set('to',exactDate);next.delete('date');}
    if(value)next.set(key,value);else next.delete(key);
    next.delete('page');return next;
  },{replace:true});
  const setSearch=(v:string)=>updateFilter('search',v),setStatus=(v:string)=>updateFilter('status',v);
  const setFrom=(v:string)=>updateFilter('from',v),setTo=(v:string)=>updateFilter('to',v);
  const setEmployee=(v:string)=>updateFilter('employee',v),setCustomer=(v:string)=>updateFilter('customer',v),setPayment=(v:string)=>updateFilter('method',v);
  const setPage=(value:number)=>setParams(previous=>{const next=new URLSearchParams(previous);if(value)next.set('page',String(value));else next.delete('page');return next;},{replace:true});
  const returnTo='/transactions'+(params.size?'?'+params.toString():'');
  const scrollKey='taha-transactions-scroll:'+returnTo;
  const restored=useRef('');
  const rememberScroll=()=>{try{sessionStorage.setItem(scrollKey,String(document.getElementById('main-content')?.scrollTop??0));}catch{/* Optional view state. */}};
  const invalidRange = !!from && !!to && from > to;
  const filter={search,status,from,to,employee:ownerOnly?"":employee,customer,method:payment,page,limit:25};
  const q=useRepository("transactions-"+JSON.stringify(filter),async()=>r.sales.page ? r.sales.page(filter) : {rows:await r.sales.list(),total:0,page:0,limit:25},!invalidRange);
  const methods = useRepository("methods", () => r.payments.list());
  const viewCustomers=usePermission('customers.view'),createCredit=usePermission('credit.create'),receiveCredit=usePermission('credit.receive_payment'),viewEmployees=usePermission('employees.view');
  const customers=useRepository('receipt-filter-customers',()=>r.customers.list(),viewCustomers||createCredit||receiveCredit);
  const employees=useRepository('receipt-filter-employees',()=>r.employees.list(),viewEmployees);
  const rows=q.data?.rows??[];
  useEffect(()=>{
    if(q.isPending||restored.current===scrollKey)return;
    const frame=requestAnimationFrame(()=>{restored.current=scrollKey;let top=0;try{top=Number(sessionStorage.getItem(scrollKey))||0;}catch{/* Optional view state. */}document.getElementById('main-content')?.scrollTo({top});});
    return()=>cancelAnimationFrame(frame);
  },[q.isPending,scrollKey]);
  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Recorded sales, payment breakdowns and preserved history."
        action={
          <Link className="button button-primary" to="/pos">
            New Sale
          </Link>
        }
      />
      <FilterBar>
        <SearchInput
          value={search}
          onChange={value=>{setSearch(value);}}
          placeholder="Invoice, customer, phone, product or cashier…"
        />
        <AppSelect
          className="input"
          aria-label="Payment filter"
          value={payment}
          onChange={(e) => {setPayment(e.target.value);}}
        >
          <option value="">All payments</option>
          {methods.data?.map((m) => (
            <option value={m.id} key={m.id}>
              {m.name}
            </option>
          ))}
        </AppSelect>
        {!ownerOnly&&<AppSelect
          className="input"
          aria-label="Employee filter"
          value={employee}
          onChange={(e) => {setEmployee(e.target.value);}}
        >
          <option value="">All employees</option>
          {Array.from(
            new Map([...(employees.data??[]).map(e=>[e.id,e.full_name] as const),...(q.data?.rows ?? []).map((s) => [s.employeeId, s.employeeName] as const)]),
          ).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </AppSelect>}
        <AppSelect className="input" aria-label="Customer filter" value={customer} onChange={e=>{setCustomer(e.target.value);}}><option value="">All customers</option>{Array.from(new Map([...(customers.data??[]).map(c=>[c.id,c.name] as const),...rows.filter(s=>s.customerId).map(s=>[s.customerId,s.customerName] as const)])).map(([id,name])=><option key={id} value={id}>{name}</option>)}</AppSelect>
        <AppSelect
          className="input"
          aria-label="Transaction status"
          value={status}
          onChange={(e) => {setStatus(e.target.value);}}
        >
          <option value="">All statuses</option>
          {["Paid", "Partial", "Credit", "Voided", "Returned"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </AppSelect>
        <DatePicker label="Transaction start date" value={from} max={to||undefined} onChange={value=>{setFrom(value);}}/>
        <DatePicker label="Transaction end date" value={to} min={from||undefined} onChange={value=>{setTo(value);}}/>
      </FilterBar>
      {customer&&<p className="text-sm text-muted">Showing this customer's receipts. <button className="text-link" onClick={()=>{setCustomer('');}}>Show all customers</button></p>}
      {invalidRange ? <p role="alert" className="form-error">Start date must be on or before end date.</p> : <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <DataTable
          pageSize={25}
          serverPagination={{page,total:q.data?.total ?? rows.length,onPage:setPage}}
          rows={rows}
          onRow={sale=>{rememberScroll();navigate("/transactions/"+sale.id,{state:{returnTo}});}}
          columns={[
            {
              label: "Invoice",
              render: (s) => (
                <Link to={"/transactions/" + s.id} state={{returnTo}} onClick={rememberScroll}>
                  <strong>{s.invoice}</strong>
                  <small className="cell-secondary">{stamp(s.createdAt)}</small>
                </Link>
              ),
            },
            { label: "Customer", render: (s) => s.customerName },
            ...(!ownerOnly?[{ label: "Employee", render: (s:Sale) => s.employeeName }]:[]),
            {
              label: "Items",
              render: (s) => s.lines.reduce((n, l) => n + l.quantity, 0),
            },
            {
              label: "Payment Method",
              render: (s) =>
                paymentSummary(s.payments,methods.data),
            },
            { label: "Total", render: (s) => currency(s.total) },
            {
              label: "Status",
              render: (s) => <StatusBadge status={s.status} />,
            },
            {label:'Returns',render:s=>Object.values(s.returned).some(quantity=>quantity>0)?s.status==='Returned'?'Fully returned':'Partially returned':'No returns'},
          ]}
        />
      </QueryState>}
    </>
  );
}
export function TransactionDetailPage({
  complete = false,
}: {
  complete?: boolean;
}) {
  const { id = "" } = useParams();
  const location=useLocation();
  const returnTo=typeof location.state?.returnTo==='string'&&location.state.returnTo.startsWith('/transactions?')?location.state.returnTo:'/transactions';
  const q = useRepository("sale-" + id, async () => ({
    sale: await r.sales.get(id),
    methods: await r.payments.list(),
    settings: await r.settings.get(),
  }));
  const a = useAction();
  const [confirm, setConfirm] = useState(false);
  const [proof, setProof] = useState("");
  const [invoiceFormat,setInvoiceFormat] = useState<"receipt"|"invoice">("receipt");
  const print=(format:"receipt"|"invoice")=>{setInvoiceFormat(format);requestAnimationFrame(()=>requestAnimationFrame(()=>{const element=document.querySelector<HTMLElement>(".receipt-preview");if(element)receiptPrinter.print(element,format);} ));};
  const canVoid = usePermission("sales.void");
  const canReturn=usePermission("returns.create");
  const canReverse=usePermission("payments.reverse");
  const s = q.data?.sale;
  const customer=useRepository('receipt-customer-'+(s?.customerId??''),async()=>s?.customerId?(await r.customers.get(s.customerId).catch(()=>undefined)):undefined);
  useEffect(() => {
    if (complete && q.data?.settings.receiptPrinting === "Always Print") {
      const timeout = setTimeout(() => {const element=document.querySelector<HTMLElement>(".receipt-preview");if(element)receiptPrinter.print(element,"receipt");}, 500);
      return () => clearTimeout(timeout);
    }
  }, [complete, q.data?.settings.receiptPrinting]);
  return (
    <>
      <PageHeader
        title={s?.syncStatus==='REFUNDED'?'Cash Refunded':complete ? "Sale Complete" : (s?.invoice ?? "Invoice")}
        subtitle={
          s?.syncStatus==='REFUNDED'?'The retained offline collection was refunded in full. Original receipt amounts are preserved.':complete
            ? s?.syncStatus==='PENDING_SYNC' ? "Cash sale saved locally. Your receipt number is final; synchronization will run automatically." : localDemoEnabled ? "Payment recorded and stock updated on this device." : "Sale recorded and stock updated in the shared backend."
            : "Original invoice and preserved payment history."
        }
        action={
          <>
            {!complete&&<Link className="button button-secondary" to={returnTo}>Back to Transactions</Link>}
            <Button onClick={() => print("receipt")}>Print Receipt</Button>
            <Button onClick={() => print("invoice")}>Print Full Invoice</Button>
            {s&&<><Button disabled={a.busy} onClick={()=>void a.run(()=>downloadInvoicePdf(s),"Invoice PDF downloaded")}>Download PDF</Button><VirtualReceipt sale={s} phone={customer.data?.phone}/></>}
            {complete && (
              <Link
                className="button button-secondary"
                to={"/transactions/" + id}
              >
                View Invoice
              </Link>
            )}
            <Link className="button button-primary" to="/pos">
              New Sale
            </Link>
          </>
        }
      />
      {complete && s && <div className="sale-complete-banner"><div><span>SALE COMPLETE</span><strong>{s.invoice}</strong><span>Your receipt is ready.</span></div><strong>{currency(s.total)}</strong></div>}
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {s ? (
          <div className="detail-layout">
            <div className="invoice-preview-panel"><div className="invoice-format-controls"><Button size="small" variant={invoiceFormat==='receipt' ? 'primary' : 'secondary'} onClick={()=>setInvoiceFormat("receipt")}>Receipt</Button><Button size="small" variant={invoiceFormat==='invoice' ? 'primary' : 'secondary'} onClick={()=>setInvoiceFormat("invoice")}>Full Invoice</Button></div><ReceiptPreview sale={s} format={invoiceFormat}/></div>
            <section className="panel form-section">
              <h2>Invoice Details</h2>
              <div className="detail-grid">
                <div>
                  <span>Customer</span>
                  <strong>{s.customerName}</strong>
                </div>
                <div>
                  <span>Employee</span>
                  <strong>{s.employeeName}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <StatusBadge status={s.syncStatus==='REFUNDED'?'Refunded':s.status} />
                </div>
                <div>
                  <span>Total</span>
                  <strong>{currency(s.total)}</strong>
                </div>
                {!localDemoEnabled && <><div><span>Paid</span><strong>{currency(s.paid ?? 0)}</strong></div><div><span>Outstanding</span><strong>{currency(s.outstanding ?? 0)}</strong></div></>}
              </div>
              <h3 className="mt-6">Payments</h3>
              {s.payments.map((p, i) => (
                <div className="summary-line" key={i}>
                  <span>
                    {p.methodName ?? q.data?.methods.find((m) => m.id === p.methodId)?.name}{" "}
                    {p.reference} {p.status && `· ${p.status}`} {p.kind && p.kind!=="sale" && `· ${p.kind}`}
                  </span>
                  <strong>{currency(p.amount)}</strong>
                  {p.proof && (
                    <Button
                      size="small"
                      onClick={() => {if(localDemoEnabled)setProof(p.proof ?? "");else void a.run(()=>proofUrl(p.proof!),"Proof loaded",url=>setProof(url ?? ""));}}
                    >
                      View Proof
                    </Button>
                  )}
                  {canReverse && r.payments.reverse && p.id && p.status==="Confirmed" && p.kind==="sale" && s.customerId && <Button size="small" onClick={()=>{const reason=window.prompt("Reason for reversing this payment. The amount becomes outstanding; no external refund is automatic.");if(reason?.trim())void a.run(()=>r.payments.reverse!(p.id!,reason),"Payment reversed");}}>Reverse Payment</Button>}
                </div>
              ))}
              {s.lines
                .filter((l) => l.approval || l.reason)
                .map((l) => (
                  <p className="auth-notice" key={l.productId}>
                    {l.name}: {l.reason}{" "}
                    {l.approval && "· Approved by " + l.approval.managerName}
                  </p>
                ))}
              <div className="form-actions">
                {canReturn && (!s.syncStatus||s.syncStatus==='SYNCED') && <Link
                  className="button button-secondary"
                  to={"/returns?invoice=" + s.id}
                >
                  Return Items
                </Link>}
                {canVoid && (!s.syncStatus||s.syncStatus==='SYNCED') && s.status !== "Voided" && (
                  <Button onClick={() => setConfirm(true)}>
                    Void / Reverse Sale
                  </Button>
                )}
              </div>
              {complete &&
                q.data?.settings.receiptPrinting === "Ask After Checkout" && (
                  <p className="text-sm text-muted mt-4">
                    Receipt ready. Use Print Receipt when the customer needs a
                    copy.
                  </p>
                )}
            </section>
          </div>
        ) : (
          <p>Invoice not found.</p>
        )}
      </QueryState>
      <Dialog
        open={!!proof}
        onOpenChange={(open) => {
          if (!open) setProof("");
        }}
        title="Payment Proof"
        description="Private image attached to the original payment."
      >
        <MediaImage
          style={{ width: "100%", objectFit: "contain", maxHeight: "60vh" }}
          src={proof || undefined}
          alt="Uploaded payment proof"
        />
      </Dialog>
      <ConfirmDialog
        open={confirm}
        title="Reverse this sale?"
        description={localDemoEnabled ? "Stock and payments will be reversed. The original invoice remains in history." : "Confirm that the customer's manual refund has been paid. Stock is restored and a refund record is added. The original invoice remains. No external gateway refund is automatic."}
        onClose={() => setConfirm(false)}
        busy={a.busy}
        onConfirm={() =>
          void a.run(
            () => r.sales.void(id),
            "Sale reversed",
            () => setConfirm(false),
          )
        }
      />
    </>
  );
}
export function ReturnsPage() {
  const {ownerOnly}=useShopConfiguration();
  const [view,setView]=useState('Receipts');
  const [historyDetail,setHistoryDetail]=useState<ReturnRecord|null>(null);
  const [returnRequestId,setReturnRequestId]=useState(()=>crypto.randomUUID());
  const [params] = useSearchParams();
  const [invoice, setInvoice] = useState(params.get("invoice") ?? "");
  const canApprove=usePermission("returns.approve");
  const q = useRepository("returns-"+invoice, async () => ({
    returns: await r.sales.returns(invoice||undefined),
    settings: await r.settings.get(),
    employees: localDemoEnabled ? await r.employees.list() : (await transactionApprovalService.list("returns.approve")).map(e=>({...e,role:"manager",permissions:["returns.approve"]})),
    availableLocations:await r.inventory.conditionLocations?.('Available')??[],
    damagedLocations:await r.inventory.conditionLocations?.('Damaged')??[],
  }));
  const [selectedSale,setSelectedSale]=useState<Sale|null>(null);
  const selected=useRepository('return-selected-'+invoice,async()=>invoice?(r.sales.lookup?(await r.sales.lookup({id:invoice,limit:1})).rows[0]:await r.sales.get(invoice)):undefined,!!invoice&&!selectedSale);
  const a = useAction();
  const sale=selectedSale??selected.data;
  const fields: FormField[] = [
    {
      key: "productId",
      label: "Original invoice item",
      type: "select",
      required: true,
      options: sale?.lines
        .filter((l) => l.quantity > (sale.returned[l.productId] ?? 0))
        .map((l) => ({
          value: l.productId,
          label: `${l.name} · ${sale.returned[l.productId]??0} already returned · ${l.quantity - (sale.returned[l.productId] ?? 0)} returnable`,
        })),
    },
    {
      key: "quantity",
      label: "Return quantity",
      type: "number",
      min: 1,
      required: true,
    },
    { key: "reason", label: "Return reason", required: true },
    {
      key: "destination",
      label: "Stock disposition",
      type: "select",
      required: true,
      options: options(["Sellable Stock", "Damaged", "Do Not Restore Stock"]),
    },
    {key:'locationId',label:'Sellable destination box',type:'select',visibleWhen:v=>v.destination==='Sellable Stock',options:q.data?.availableLocations.map(l=>({value:l.locationId,label:l.path}))},
    {key:'damagedLocationId',label:'Damaged / Quarantine box',type:'select',required:true,visibleWhen:v=>v.destination==='Damaged',options:q.data?.damagedLocations.map(l=>({value:l.locationId,label:l.path})),help:'Damaged stock stays unavailable for sale. Create a quarantine box in Locations if none exists.'},
    ...(!localDemoEnabled ? [{key:'receiptConfirmed',label:'Original receipt checked',type:'checkbox' as const},{key:'manualRefundConfirmed',label:'Manual refund paid (no automatic gateway refund)',type:'checkbox' as const}]:[]),
    ...(canApprove&&sale?.lines.some(line=>line.compound)?[{key:'refundLabor',label:'Also refund service / labor (authorized exception)',type:'checkbox' as const,visibleWhen:(v:Record<string,unknown>)=>!!sale?.lines.find(line=>line.productId===v.productId)?.compound,help:'By default, only the linked product portion is refunded. Enable only when you authorize refunding the labor too.'}]:[]),
    ...(q.data?.settings.returnApproval && (localDemoEnabled || !canApprove)
      ? [
          {
            key: "approval",
            label: localDemoEnabled ? "Demo approving manager" : "Approving manager",
            type: "select" as const,
            required: true,
            options: q.data.employees
              .filter(
                (e) =>
                  e.role === "owner" ||
                  e.permissions.includes("returns.approve"),
              )
              .map((e) => ({ value: e.id, label: e.full_name })),
          },
          { key: "pin", label:localDemoEnabled ? "Demo manager PIN (123456)" : "Manager PIN", required: true },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader
        title="Returns"
        subtitle="Return items against an original invoice and preserve the full history."
      />
      <Tabs items={['Receipts','Return History']} value={view} onChange={setView}/>
      <div hidden={view!=='Receipts'}><div className="returns-workspace"><aside className="panel form-section"><ReceiptLookup onSelect={receipt=>{setSelectedSale(receipt);setInvoice(receipt.id);setReturnRequestId(crypto.randomUUID());}}/></aside><section className="panel form-section return-work-area">
        <QueryState pending={q.isPending} error={q.isError} retry={()=>void q.refetch()}>
        {!sale?<div className="empty-state"><h2>Select a receipt</h2><p>Choose an invoice to inspect its items, returnable quantities and previous returns.</p></div>:<div className="return-selected-receipt"><span><strong>{sale.invoice} · {sale.customerName}</strong><small>{stamp(sale.createdAt)}{!ownerOnly&&` · Cashier: ${sale.employeeName}`}</small></span><Link className="text-link" to={'/transactions/'+sale.id}>Open Original Transaction</Link></div>}
        {sale&&['Voided','Returned'].includes(sale.status)&&<div className="auth-notice"><strong>{sale.status==='Returned'?'Fully returned invoice':'Voided invoice'}</strong><p>This invoice remains available for inspection. No additional return can be created.</p><ReceiptPreview sale={sale}/></div>}
        {sale?.lines.some(line=>line.compound)&&<p className="auth-notice">Combined service returns refund the product portion by default. Labor is retained unless an authorized refund exception is selected.</p>}
        {sale && q.data && !["Voided","Returned"].includes(sale.status) && (
          <RecordForm
            key={sale.id}
            fields={fields}
            initial={{
              locationId:sale.lines[0]?.locationId,
              quantity: 1,
              destination: q.data?.settings.restoreReturns
                ? "Sellable Stock"
                : "Do Not Restore Stock",
            }}
            busy={a.busy}
            submit="Process Return"
            onSubmit={(v) =>
              void a.run(
                async () => {
                  const payload={saleId:invoice,productId:text(v.productId),quantity:num(v.quantity),reason:text(v.reason),destination:text(v.destination),locationId:text(v.destination==='Damaged'?v.damagedLocationId:v.locationId),receiptConfirmed:Boolean(v.receiptConfirmed),manualRefundConfirmed:Boolean(v.manualRefundConfirmed),...(sale.lines.find(line=>line.productId===v.productId)?.compound?{refundLabor:canApprove&&Boolean(v.refundLabor)}:{}),idempotencyKey:returnRequestId};
                  const approvalToken=!localDemoEnabled && q.data?.settings.returnApproval && !canApprove ? (await transactionApprovalService.approve(text(v.approval),text(v.pin),"return",payload)).token : undefined;
                  return r.sales.returnItem(
                    invoice,
                    text(v.productId),
                    num(v.quantity),
                    text(v.reason),
                    text(v.destination) as ReturnRecord["destination"],
                    localDemoEnabled && q.data?.settings.returnApproval
                      ? await demoApprovalService.verifyAction(
                          text(v.approval),
                          text(v.pin),
                          "returns.approve",
                        )
                      : undefined,
                    {...payload,approvalToken},
                  );
                },
                "Return recorded",
                ()=>{setReturnRequestId(crypto.randomUUID());setSelectedSale(null);},
              )
            }
          />
        )}
        </QueryState>
      </section>
      </div></div><div hidden={view!=='Return History'}><h2 className="section-title mt-6">{sale?"Selected receipt return history":"Recent return history"}</h2>
      <DataTable
        rows={(q.data?.returns ?? []).filter(row=>!sale||row.saleId===sale.id)}
        onRow={setHistoryDetail}
        columns={[
          { label: "Return", render: (t) => t.code },
          {
            label: "Invoice",
            render: (t) => (
              <Link to={"/transactions/" + t.saleId}>
                {t.saleId===sale?.id?sale.invoice:'View original invoice'}
              </Link>
            ),
          },
          { label: "Quantity", render: (t) => t.quantity },
          { label: "Reason", render: (t) => t.reason },
          { label: "Disposition", render: (t) => t.destination },
          { label: "Refund", render: (t) => currency(t.amount) },
        ]}
      />
      </div>
      <Dialog open={!!historyDetail} onOpenChange={open=>{if(!open)setHistoryDetail(null);}} title="Return details" description="Original return and financial disposition are preserved.">{historyDetail&&<div className="detail-grid"><div><span>Reference</span><strong>{historyDetail.code}</strong></div><div><span>Quantity</span><strong>{historyDetail.quantity}</strong></div><div><span>Amount</span><strong>{currency(historyDetail.amount)}</strong></div><div><span>Condition</span><strong>{historyDetail.destination}</strong></div><div><span>Reason</span><strong>{historyDetail.reason}</strong></div><Link className="text-link" to={'/transactions/'+historyDetail.saleId}>View original invoice</Link></div>}</Dialog>
    </>
  );
}
