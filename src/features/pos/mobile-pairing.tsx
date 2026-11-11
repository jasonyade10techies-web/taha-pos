import { useEffect,useRef,useState } from "react";
import { useNavigate,useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { deviceBridgeService } from "../../lib/device-bridge/service";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import { useAction } from "../../hooks/use-repository";
import {toast} from '../../stores/toast-store';
export function MobilePairing({ code, onPaired,automatic=false }: { code: string; onPaired?:()=>void;automatic?:boolean }) {
  const [name, setName] = useState(useDeviceBridgeStore.getState().deviceName), action = useAction();
  const [params, setParams] = useSearchParams();
  const navigate=useNavigate(),pending=useRef<{code:string;promise:ReturnType<typeof deviceBridgeService.pair>}|null>(null),[error,setError]=useState(''),auth=useDeviceBridgeStore(s=>s.auth);
  useEffect(()=>{if(!automatic||auth!=='signed-in')return;let active=true;if(pending.current?.code!==code)pending.current={code,promise:deviceBridgeService.pair(code,useDeviceBridgeStore.getState().deviceName)};void pending.current.promise.then(paired=>{if(!active)return;toast(`Connected to ${paired.terminalName||'Main Counter'}`);onPaired?.();navigate('/mobile/devices',{replace:true});}).catch(c=>{if(active)setError(c instanceof Error?c.message:'Unable to pair this phone.');});return()=>{active=false;};},[automatic,auth,code,navigate,onPaired]);
  if(automatic)return <section className="staff-pair-progress" role={error?'alert':'status'}><p>{error||'Connecting to counter…'}</p>{error&&<Button onClick={()=>{setError('');void deviceBridgeService.pair(code,name).then(()=>{toast('Phone connected');onPaired?.();navigate('/mobile/devices',{replace:true});}).catch(c=>setError(c.message));}}>Try Again</Button>}</section>;
  return <section className="panel mobile-pairing"><h2>Pair this phone?</h2><p>TAHA MOBILES · Main Branch</p><p>Counter: Main Counter</p><label className="form-field">Device name<input className="input" value={name} maxLength={80} onChange={e => setName(e.target.value)}/></label>{action.error && <p role="alert" className="text-danger">{action.error}</p>}<Button variant="primary" disabled={!name.trim() || action.busy} onClick={() => void action.run(async () => {const paired=await deviceBridgeService.pair(code,name);const next = new URLSearchParams(params); next.delete("pair");next.set("terminal",paired.terminalId);setParams(next, { replace: true });onPaired?.();}, "Paired Successfully")}>{action.busy ? "Pairing…" : "Pair Device"}</Button></section>;
}
