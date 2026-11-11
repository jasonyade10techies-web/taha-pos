import { AppSelect } from '../ui/app-select';
import {useState} from "react";
import type {PaymentMethod} from "../../types/demo";
import {repositories} from "../../lib/repositories";
import {useAction} from "../../hooks/use-repository";
import {usePermission} from "../../hooks/use-permission";
import {Button} from "../ui/button";
import {PermissionToggle} from "../ui/workspace";
import {ManagerApproval} from "./manager-approval";
import {ProofUploader} from "./proof-uploader";
export function CreditPaymentForm({customerId,balance,methods,onComplete}:{customerId:string;balance:number;methods:PaymentMethod[];onComplete:(code:string,amount:number)=>void}) {
 const [amount,setAmount]=useState(balance);const [selection,setMethod]=useState(methods[0]?.id ?? "");const [reference,setReference]=useState("");const [notes,setNotes]=useState("");const [proof,setProof]=useState("");
 const [verified,setVerified]=useState(false);const [token,setToken]=useState("");const [id]=useState(()=>crypto.randomUUID());const canVerify=usePermission("payments.approve_electronic");const a=useAction();
 const method=methods.find(m=>m.id===selection);const digital=method?.kind==="Digital";
 return <form onSubmit={e=>{e.preventDefault();void a.run(()=>repositories.credit.receive(customerId,amount,selection,reference,notes,{proof,verified,approvalToken:token || undefined,cartId:id,idempotencyKey:id}),"Payment received",code=>onComplete(code,amount));}}>
  <label className="form-field">Amount (PKR)<input className="input" type="number" required min="0.01" max={balance} step="0.01" value={amount} onChange={e=>{setAmount(Number(e.target.value));setToken("");}}/></label>
  <label className="form-field mt-3">Payment method<AppSelect aria-label="Payment method" className="input" value={selection} onChange={e=>{setMethod(e.target.value);setVerified(false);setToken("");}}>{methods.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</AppSelect></label>
  <label className="form-field mt-3">Reference<input className="input" value={reference} onChange={e=>{setReference(e.target.value);setToken("");}}/></label>
  <label className="form-field mt-3">Notes<textarea className="input" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
  {digital && <><ProofUploader value={proof} onChange={p=>{setProof(p);setToken("");}}/>{canVerify?<PermissionToggle label="Payment received and verified" checked={verified} onChange={setVerified}/>:token?<p className="text-success">Manager verification attached</p>:<ManagerApproval purpose="payment" payload={{cartId:id,methodId:selection,amount,reference,proof}} onApproved={setToken}/>}</>}
  {a.error && <p role="alert" className="text-danger">{a.error}</p>}
  <div className="dialog-actions"><Button variant="primary" type="submit" disabled={a.busy || !method || amount<=0 || amount>balance || digital && (!proof || (canVerify?!verified:!token))}>Receive Payment</Button></div>
 </form>;
}
