import {useEffect,useState} from 'react';
import {pendingCaptures,discardCapture,type PendingCapture} from '../../lib/mobile/pending-captures';
import {useCameraStore} from '../../stores/camera-store';
import {Button} from '../../components/ui/button';
import {ConfirmDialog} from '../../components/ui/workspace';
import {toast} from '../../stores/toast-store';
import './saved-photo-recovery.css';
type CameraOriginal={id:string;createdAt:number;bytes:number};
function recoveryState(){try{return {originals:JSON.parse(window.TahaNative?.readCameraOriginals?.()||'[]') as CameraOriginal[],issues:window.TahaNative?.photoRecoveryIssues?.()||0};}catch{return {originals:[] as CameraOriginal[],issues:1};}}
/** An expired request must not silently destroy its unacknowledged image. */
export function SavedPhotoRecovery(){
 const jobs=useCameraStore(state=>state.jobs),[captures,setCaptures]=useState(()=>pendingCaptures()),[discard,setDiscard]=useState<PendingCapture|null>(null),[now,setNow]=useState(Date.now());
 const [recovery,setRecovery]=useState(recoveryState),[originalToDiscard,setOriginalToDiscard]=useState<string|null>(null);
 useEffect(()=>{const refresh=()=>{setCaptures(pendingCaptures());setRecovery(recoveryState());setNow(Date.now());};window.addEventListener('taha-pending-photos',refresh);const timer=setInterval(refresh,5000);return()=>{clearInterval(timer);window.removeEventListener('taha-pending-photos',refresh);};},[]);
 const saved=captures.filter(capture=>!jobs.some(job=>job.id===capture.requestId&&!['expired','cancelled','received'].includes(job.status)&&(!job.expiresAt||Date.parse(job.expiresAt)>now)));
 if(!saved.length&&!recovery.originals.length&&!recovery.issues)return null;
 const copyResult=(ok:boolean)=>toast(ok?'Copy saved to gallery. The private original is still retained.':'Could not save a gallery copy on this device. The private photo is still retained.',ok?'success':'warning');
 return <section className="panel form-section">
 {recovery.issues>0&&<p role="alert">{recovery.issues} saved photo records need recovery. Their files are retained privately and will not be uploaded. Other photos still work. Keep app data and contact the shop owner before clearing storage.</p>}
 {recovery.originals.length>0&&<><h2>Retained camera photos</h2><p>The camera was interrupted or its photo has not yet been retained for upload. Save a copy and choose it for the correct request. No photo is sent automatically.</p>{recovery.originals.map(original=><div className="staff-saved-photo" key={original.id}><span>Camera photo · {new Date(original.createdAt).toLocaleString('en-PK',{timeZone:'Asia/Karachi'})}</span><Button onClick={()=>copyResult(window.TahaNative?.exportCameraOriginal?.(original.id)===true)}>Save Camera Copy</Button><Button variant="ghost" onClick={()=>setOriginalToDiscard(original.id)}>Discard Camera Photo</Button></div>)}</>}
 {saved.length>0&&<><h2>Saved photos need review</h2><p>The request is unavailable or expired. These photos are retained privately. Save a copy, then ask the counter for a new request.</p>{saved.map(capture=><div className="staff-saved-photo" key={capture.captureId}><span>Photo · {new Date(capture.createdAt).toLocaleString('en-PK',{timeZone:'Asia/Karachi'})}</span><Button onClick={()=>copyResult(window.TahaNative?.saveToGallery?.(capture.data)===true)}>Save Copy</Button><Button variant="ghost" onClick={()=>setDiscard(capture)}>Discard</Button></div>)}</>}
 <ConfirmDialog open={!!discard} title="Discard this unsent photo?" description="This permanently removes the retained photo. Save a copy first if you still need it." confirm="Discard Photo" onClose={()=>setDiscard(null)} onConfirm={()=>{if(discard)discardCapture(discard.requestId,discard.captureId);setDiscard(null);}}/>
 <ConfirmDialog open={!!originalToDiscard} title="Discard this camera original?" description="Save a gallery copy first if you still need this interrupted photo. Discard permanently removes the private original." confirm="Discard Photo" onClose={()=>setOriginalToDiscard(null)} onConfirm={()=>{if(originalToDiscard)window.TahaNative?.discardCameraOriginal?.(originalToDiscard);setOriginalToDiscard(null);setRecovery(recoveryState());}}/>
 </section>;
}
