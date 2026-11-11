import {Field} from '../ui/workspace';
import { AppSelect } from '../ui/app-select';
import {useState} from "react";
import {transactionApprovalService} from "../../lib/supabase/approval-service";
import {useRepository,useAction} from "../../hooks/use-repository";
import {Button} from "../ui/button";
export function ManagerApproval({purpose,payload,onApproved}:{purpose:"price"|"payment"|"return";payload:unknown;onApproved:(token:string)=>void}) {
  const permission=purpose==="price"?"pricing.override_minimum":purpose==="payment"?"payments.approve_electronic":"returns.approve";
  const q=useRepository("approvers-"+purpose,()=>transactionApprovalService.list(permission));
  const [manager,setManager]=useState("");const [pin,setPin]=useState("");const a=useAction();
  return <div className="auth-notice"><strong>Manager approval</strong><p>Verified by the server. Approval expires in five minutes and applies to this request once.</p>
    <Field label="Approving manager"><AppSelect className="input" value={manager || q.data?.[0]?.id || ""} onChange={e=>setManager(e.target.value)}>{q.data?.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</AppSelect></Field>
    <label className="form-field mt-3">Manager PIN<input className="input" type="password" autoComplete="off" inputMode="numeric" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}/></label>
    {a.error && <p role="alert" className="text-danger">{a.error}</p>}
    <Button type="button" disabled={a.busy || pin.length!==6 || !q.data?.length} onClick={()=>void a.run(()=>transactionApprovalService.approve(manager || q.data![0].id,pin,purpose,payload),"Manager approval verified",result=>{setPin("");onApproved(result.token!);})}>Verify approval</Button>
  </div>;
}
