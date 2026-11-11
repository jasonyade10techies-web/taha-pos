import {useEffect,useRef,useState} from "react";
import {useSearchParams,Link} from "react-router-dom";
import {Camera,CheckCircle2,Menu,Link2,ScanLine} from "lucide-react";
import {Logo} from "../../components/ui/logo";
import {MobileNavigation} from "../../components/layout/mobile-navigation";
import {Dialog} from "../../components/ui/dialog";
import {Button} from "../../components/ui/button";
import {MobilePairing} from "./mobile-pairing";
import {MobileCaptureCard} from "./mobile-capture-card";
import {useSessionStore} from "../../stores/session-store";
import {useCameraStore} from "../../stores/camera-store";
import {useCameraTransport} from "../../hooks/use-camera-transport";
import {deviceBridgeService} from "../../lib/device-bridge/service";
import {useDeviceBridgeStore} from "../../stores/device-bridge-store";
import {cameraService,cameraError} from "../../lib/camera-service";
import {cameraTypeLabel} from "../../stores/camera-store";
export function MobileCameraPage(){
 const [params,setParams]=useSearchParams(),bridge=useDeviceBridgeStore(),employee=useSessionStore(s=>s.employee);
 const terminalId=params.get("terminal")||bridge.ownPair?.terminalId||bridge.terminalId;
 useCameraTransport(terminalId,true);
 const jobs=useCameraStore(s=>s.jobs),[selected,setSelected]=useState<string|null>(params.get('job')),[pairOpen,setPairOpen]=useState(false),[pairCode,setPairCode]=useState(""),[devicesOpen,setDevicesOpen]=useState(params.get("devices")==="true"),[error,setError]=useState("");
 const [tab,setTab]=useState<'requests'|'sent'>('requests');const [,tick]=useState(0);
 useEffect(()=>{if(params.get('devices')==='true')setDevicesOpen(true);},[params]);
 useEffect(()=>{const timer=setInterval(()=>tick(v=>v+1),5000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const id=params.get('job'),token=params.get('claim');if(!id)return;setSelected(id);if(token){void cameraService.claim(id,token).then(()=>{const next=new URLSearchParams(params);next.delete('claim');next.delete('store');setParams(next,{replace:true});}).catch(c=>setError(cameraError(c)));}},[params,setParams]);
 const assigned=jobs.filter(j=>j.terminalId===terminalId&&!j.diagnostic),pending=assigned.filter(j=>!['received','cancelled','expired'].includes(j.status)&&(!j.expiresAt||Date.parse(j.expiresAt)>Date.now())),sent=assigned.filter(j=>j.status==='received');
 const queueGroups=tab==="requests"?[{heading:"NEW",items:pending.filter(j=>j.status==="waiting")},{heading:"IN PROGRESS",items:pending.filter(j=>j.status!=="waiting")}]:[{heading:"RECENTLY COMPLETED",items:sent.slice(0,10)}];
 const urgentId=pending.length===1?pending[0].id:undefined;
 const surfaced=useRef(new Set<string>());useEffect(()=>{if(!selected&&urgentId&&!surfaced.current.has(urgentId)){surfaced.current.add(urgentId);setSelected(urgentId);}},[urgentId,selected]);
 const selectedJob=assigned.find(j=>j.id===selected);const close=()=>{setSelected(null);const next=new URLSearchParams(params);next.delete('job');setParams(next,{replace:true});};
 return <div className="staff-companion"><header className="staff-mobile-header"><button aria-label="Open navigation" onClick={()=>window.dispatchEvent(new Event('taha-open-mobile-menu'))}><Menu size={22}/></button><Logo/><Link className="avatar" to="/profile" aria-label="Your profile">{employee.initials}</Link></header><main className="mobile-camera-page">
 <section className="mobile-camera-hero"><span className="eyebrow">STAFF WORKSPACE</span><h1>{params.get('view')==='alerts'?'Alerts':'Camera Requests'}</h1><p>Take a photo. It appears at the counter automatically.</p></section>
 <section className="staff-connection-panel"><span className="staff-camera-icon"><Camera size={23}/></span><div><strong>{bridge.ownPair?bridge.ownPair.terminalName||'Main Counter':'No Counter Paired'}</strong><small>{bridge.ownPair?(bridge.connected?'Connected · Ready for photo requests':'Reconnecting…'):'Pair your phone to receive camera requests from a Taha POS counter.'}</small></div></section>
 {params.get('pair')&&<MobilePairing code={params.get('pair')!}/>}
 <div className="staff-quick-actions"><Button variant="primary" onClick={()=>window.dispatchEvent(new Event('taha-scan-open'))}><ScanLine size={20}/>Scan Pairing QR</Button><Button onClick={()=>setPairOpen(true)}><Link2 size={17}/>Enter Pairing Code</Button><Button onClick={()=>setDevicesOpen(true)}>Connected Devices</Button></div>
 {error&&<div role="alert" className="text-danger"><p>{error}</p><Button onClick={()=>{setError('');setSelected(null);setParams(new URLSearchParams(),{replace:true});}}>Return Home</Button></div>}
 <div className="staff-queue-tabs" role="tablist" aria-label="Camera queue"><button role="tab" aria-selected={tab==='requests'} onClick={()=>setTab('requests')}>Requests <span>{pending.length}</span></button><button role="tab" aria-selected={tab==='sent'} onClick={()=>setTab('sent')}>Recently Completed <span>{sent.length}</span></button></div>
 <div className="mobile-camera-list">{queueGroups.filter(group=>group.items.length).map(group=><section className="instant-request-group" key={group.heading}><h2 className="eyebrow">{group.heading}</h2>{group.items.map(job=><article className="panel instant-request-row" key={job.id}><Camera size={24}/><div><span className="eyebrow">{cameraTypeLabel(job.type)}</span><h2>{job.title}</h2><small>Main Counter · {Date.now()-Date.parse(job.createdAt)<60000?'Just now':`${Math.max(1,Math.floor((Date.now()-Date.parse(job.createdAt))/60000))} min ago`}</small></div><Button onClick={()=>setSelected(job.id)}>Open</Button></article>)}</section>)}{!(tab==='requests'?pending:sent).length&&<div className="panel staff-empty"><CheckCircle2 size={32}/><h2>{tab==='requests'?"You're all caught up":'No photos sent yet'}</h2><p>New photo requests appear here automatically.</p></div>}</div>
 </main><MobileNavigation/>
 <Dialog open={!!selectedJob} onOpenChange={value=>{if(!value)close();}} title={selectedJob?.type==='connection-test'?'Connection Test':'Photo Request'} description="Taha Mobiles · Main Counter">{selectedJob&&<MobileCaptureCard job={selectedJob} onClose={close}/>}</Dialog>
 <Dialog open={pairOpen} onOpenChange={setPairOpen} title="Enter Pairing Code" description="Enter the six-digit code shown on your counter."><label className="form-field">Pairing code<input className="input" inputMode="numeric" value={pairCode} maxLength={6} onChange={e=>setPairCode(e.target.value.replace(/\D/g,''))}/></label>{/^\d{6}$/.test(pairCode)&&<MobilePairing code={pairCode} onPaired={()=>setPairOpen(false)}/>}</Dialog>
 <Dialog open={devicesOpen} onOpenChange={value=>{setDevicesOpen(value);if(!value){const next=new URLSearchParams(params);next.delete('devices');setParams(next,{replace:true});}}} title="Connected Devices" description="Taha Mobiles · Main Branch">{bridge.ownPair?<><span className="eyebrow">CONNECTED COUNTER</span><h2>{bridge.ownPair.terminalName||'Main Counter'}</h2><p className={bridge.connected?'text-success':'text-muted'}>● {bridge.connected?'Online':'Offline'}</p><Button onClick={()=>void deviceBridgeService.heartbeat(true).catch(c=>setError(cameraError(c)))}>Send Test Connection</Button><Button onClick={()=>{setDevicesOpen(false);window.dispatchEvent(new Event('taha-scan-open'));}}>Change Counter</Button><Button onClick={()=>void deviceBridgeService.disconnect(bridge.ownPair!.id).catch(c=>setError(cameraError(c)))}>Disconnect</Button></>:<><h2>No Counter Paired</h2><p>Pair your phone to receive camera requests from a Taha POS counter.</p><Button variant="primary" onClick={()=>{setDevicesOpen(false);window.dispatchEvent(new Event('taha-scan-open'));}}>Scan Pairing QR</Button><Button onClick={()=>{setDevicesOpen(false);setPairOpen(true);}}>Enter Pairing Code</Button></>}</Dialog>
 </div>;
}


