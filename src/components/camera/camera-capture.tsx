import {toast} from '../../stores/toast-store';
import {nativeDesktop} from '../../lib/desktop/runtime';
import {preserveDesktopImage} from '../../lib/desktop/images';
import {useSyncStore} from '../../stores/sync-store';
import {getApiBaseUrl,getDeviceBridgeBaseUrl} from '../../lib/config';
import {useEffect,useRef,useState} from "react";
import {Smartphone,CheckCircle2} from "lucide-react";
import {QRCodeSVG} from "qrcode.react";
import type {CameraJobType} from "../../types/phase4b";
import {useCameraStore,cameraStatusLabel} from "../../stores/camera-store";
import {useDeviceBridgeStore} from "../../stores/device-bridge-store";
import {cameraService,cameraError} from "../../lib/camera-service";
import {localDemoEnabled,deviceBridgeConfigured} from "../../lib/config";
import {useCameraTransport} from "../../hooks/use-camera-transport";
import {shopFetch} from "../../lib/mobile/transport";
import {deviceBridgeService} from "../../lib/device-bridge/service";
import {BridgeSignInDialog} from "../devices/bridge-sign-in";
import {sharedMediaReference} from "../../lib/device-bridge/media";
import {Button} from "../ui/button";
import {Dialog} from "../ui/dialog";
import {useRepository} from "../../hooks/use-repository";
import {repositories} from "../../lib/repositories";
import type {CameraDevice} from "./camera-device-picker";
export function CameraCapture({type,title,reference,amount,onImage,onStoredImage,compact=false,entityId,targetSlot,multiple,buttonLabel='Take Photo with Phone'}: {type:CameraJobType;title:string;reference?:string;amount?:number;onImage?:(dataUrl:string)=>void;onStoredImage?:(image:{preview:string;path:string})=>void;compact?:boolean;entityId?:string;targetSlot?:string;multiple?:boolean;buttonLabel?:string}){
 const bridge=useDeviceBridgeStore(),terminalId=bridge.terminalId,employee=bridge.context?.profile?.id,preferences=useRepository("camera-preferences",()=>repositories.settings.get());
 const [signIn,setSignIn]=useState(false),[unavailable,setUnavailable]=useState<"none"|"offline"|null>(null);
 const [jobId,setJobId]=useState<string|null>(null),[qrOpen,setQrOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[devices,setDevices]=useState<CameraDevice[]|null>(null),[deliveryRetry,setDeliveryRetry]=useState(0);
 const [now,setNow]=useState(Date.now());const allJobs=useCameraStore(s=>s.jobs);
 const [instanceId]=useState(()=>crypto.randomUUID()),delivered=useRef(new Set<string>()),receiving=useRef(new Set<string>());
 const callback=useRef(onImage),storedCallback=useRef(onStoredImage);useEffect(()=>{callback.current=onImage;storedCallback.current=onStoredImage;},[onImage,onStoredImage]);
 const job=allJobs.find(j=>j.id===jobId&&j.terminalId===terminalId);useCameraTransport(terminalId);
 useEffect(()=>{if(!jobId)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[jobId]);
 useEffect(()=>{if(job?.status==='cancelled'){toast('Request cancelled','info');setQrOpen(false);setJobId(null);}},[job]);
 const phoneBusy=(device:CameraDevice)=>allJobs.some(j=>!['received','cancelled','expired'].includes(j.status)&&(!j.expiresAt||Date.parse(j.expiresAt)>now)&&(j.deviceId===device.deviceId||j.deviceId===device.id));
 useEffect(()=>{if(!job)return;const images=job.captures?.length?job.captures.map(c=>({id:c.captureId,url:c.imageUrl,path:c.imagePath})) :job.status==="received"&&job.imageDataUrl?[{id:job.id,url:job.imageDataUrl,path:job.imagePath}]:[];
  for(const image of images){if(delivered.current.has(image.id)||receiving.current.has(image.id))continue;receiving.current.add(image.id);void(async()=>{try{
   if(nativeDesktop&&getApiBaseUrl()!==getDeviceBridgeBaseUrl()){const response=await shopFetch(image.url);if(!response.ok)throw new Error('This photo could not be received from the local counter.');const blob=await response.blob();const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('The photo could not be opened.'));reader.readAsDataURL(blob);});if(useSyncStore.getState().status==='OFFLINE'){const kinds:Record<string,string>={'product-photo':'product','used-device-photo':'device','repair-intake':'repair','profile-picture':'profile','customer-photo':'customer','payment-proof':'proof','damage-evidence':'damage','receipt-document':'document'};await preserveDesktopImage(data,kinds[type]||'product');}callback.current?.(data);}
   else if(image.path&&storedCallback.current)storedCallback.current({preview:localDemoEnabled?sharedMediaReference(image.path):image.url,path:image.path});
   else if(image.path&&localDemoEnabled)callback.current?.(sharedMediaReference(image.path));
   else if(image.url.startsWith("data:"))callback.current?.(image.url);
   else {const response=await shopFetch(image.url);if(!response.ok)throw new Error("The photo could not be retrieved. Try receiving it again.");const blob=await response.blob();const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("The photo could not be opened."));reader.readAsDataURL(blob);});callback.current?.(data);}
   delivered.current.add(image.id);useDeviceBridgeStore.setState({lastUpload:'Thumbnail ready → desktop inserted: '+Math.max(0,Date.now()-Date.parse(job.captures?.find(c=>c.captureId===image.id)?.createdAt||job.createdAt))+' ms after server capture'});setError("");if(job.status==="received")setQrOpen(false);
  }catch(cause){setError(cameraError(cause));}finally{receiving.current.delete(image.id);}})();}
 },[job,deliveryRetry,type]);
 const request=async(deviceId?:string,fallback=false)=>{setBusy(true);setError("");try{const maxCaptures=(multiple??["product-photo","used-device-photo","repair-intake","damage-evidence"].includes(type))?12:1;const result=await cameraService.request({type,title,reference,amount,terminalId,entityId,targetSlot,maxCaptures,ownerInstanceId:instanceId,deviceId,fallback});setDevices(null);setJobId(result.id);if(fallback)setQrOpen(true);if(deviceId)localStorage.setItem(`taha-camera-preferred:${terminalId}:${employee}`,deviceId);}catch(cause){setError(cameraError(cause));}finally{setBusy(false);}};
 const begin=async()=>{if(useDeviceBridgeStore.getState().auth!=="signed-in"){setSignIn(true);return;}setBusy(true);setError("");setUnavailable(null);try{await deviceBridgeService.registerTerminal();const phones=await deviceBridgeService.devices(terminalId);const usable=phones.filter(d=>d.online);if(usable.length===1){if(phoneBusy(usable[0]))throw new Error((usable[0].deviceName||'Your paired phone')+' already has an active photo request. Please finish or cancel it first.');await request(usable[0].id);}else if(!usable.length)setUnavailable(phones.length?"offline":"none");else{const preferred=localStorage.getItem(`taha-camera-preferred:${terminalId}:${employee}`);setDevices([...phones].sort((a,b)=>Number(b.id===preferred)-Number(a.id===preferred)));}}catch(cause){setError(cameraError(cause));}finally{setBusy(false);}};
 const another=async()=>{if(!job)return;setBusy(true);try{await cameraService.handoff(job.id);setQrOpen(true);}catch(cause){setError(cameraError(cause));}finally{setBusy(false);}};
 const expired=!!job?.expiresAt&&Date.parse(job.expiresAt)<=now&&job.status!=='received',remaining=Math.max(0,Math.ceil(((job?.expiresAt?Date.parse(job.expiresAt):now)-now)/1000));
 const pending=job&&!expired&&!['received','cancelled','expired','failed'].includes(job.status);
 const connectedPhones=bridge.devices.filter(d=>d.terminalId===terminalId&&d.online),blocked=connectedPhones.length===1&&phoneBusy(connectedPhones[0]);
 return <div className={`camera-capture ${compact?"camera-capture-compact":""}`}>
 <Button size="small" title={blocked?'The paired phone already has an active photo request. Finish or cancel it first.':undefined} disabled={busy||!!pending||blocked||preferences.data?.mobileCameraEnabled===false} onClick={()=>void begin()}><Smartphone size={15}/>{busy?"Sending to phone…":buttonLabel}</Button>
 {unavailable&&<div className="instant-camera-state" role="status"><div><strong>{unavailable==="none"?"No Staff Phone Paired":"Your paired phone is offline."}</strong><small>{unavailable==="none"?"No staff phone is paired with this counter.":"Open Taha Staff on your phone, then retry."}</small></div><Button size="small" onClick={()=>unavailable==="none"?window.dispatchEvent(new Event("taha-pair-phone")):void begin()}>{unavailable==="none"?"Pair Phone":"Retry"}</Button><Button size="small" onClick={()=>{setUnavailable(null);void request(undefined,true);}}>Use Another Phone</Button></div>}
 {job&&<div className="instant-camera-state" role="status">{job.status==="received"?<CheckCircle2 size={17}/>:<Smartphone size={17}/>}<div><strong>{job.assignmentState==="UNASSIGNED"?"Scan the request QR to use another phone.":expired?"Photo request expired.":cameraStatusLabel(job.status)}</strong>{expired&&<Button size="small" onClick={()=>void begin()}>Try Again</Button>}{pending&&job.assignmentState!=="UNASSIGNED"&&<small>{job.deviceName?`Waiting for ${job.deviceName}. `:""}{Math.floor(remaining/60).toString().padStart(2,'0')}:{(remaining%60).toString().padStart(2,'0')} · The photo will appear automatically.</small>}</div>{pending&&<><Button size="small" variant="ghost" disabled={busy} onClick={()=>void another()}>Use Another Phone</Button><Button size="small" variant="ghost" onClick={()=>void cameraService.update(job.id,{status:"cancelled"}).catch(c=>setError(cameraError(c)))}>Cancel</Button></>}</div>}
 {error&&<p role="alert" className="text-danger">{error}{job?.captures?.length||job?.status==="received"?<Button size="small" onClick={()=>setDeliveryRetry(v=>v+1)}>Retry Receive</Button>:null}</p>}
 <Dialog open={!!devices} onOpenChange={value=>{if(!value)setDevices(null);}} title="Choose Staff Phone" description="Choose an online phone. The request will be sent immediately."><div className="camera-device-options">{devices?.map(device=><button type="button" disabled={!device.online||busy||phoneBusy(device)} key={device.id} className="camera-device-option" onClick={()=>void request(device.id)}><Smartphone size={22}/><span><strong>{device.deviceName||device.device_name||"Staff Phone"}</strong><small>{phoneBusy(device)?"Photo request in progress":device.online?"Online":"Offline"}</small></span></button>)}</div></Dialog>
 <Dialog open={qrOpen} onOpenChange={setQrOpen} title="Use Another Phone" description="Open Scan QR in Taha Staff. The photo will appear here automatically.">{job?.qrPayload?<div className="camera-request-qr"><QRCodeSVG value={job.qrPayload} size={280} bgColor="#ffffff" fgColor="#000000"/><strong>{title}</strong><p>Scan → Open Camera. No extra pairing is required.</p></div>:<p>Generate a new request QR and try again.</p>}<Button onClick={()=>setQrOpen(false)}>Close</Button></Dialog>
 <BridgeSignInDialog open={signIn} onOpenChange={setSignIn} onConnected={()=>{setSignIn(false);void begin();}}/>
 {!deviceBridgeConfigured&&signIn&&<p role="alert">Connect this counter to your shop in Settings → Devices.</p>}
 </div>;
}
