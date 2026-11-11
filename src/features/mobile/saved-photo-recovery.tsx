import {useEffect,useState} from 'react';
import {pendingCaptures,discardCapture,type PendingCapture} from '../../lib/mobile/pending-captures';
import {useCameraStore} from '../../stores/camera-store';
import {Button} from '../../components/ui/button';
import {ConfirmDialog} from '../../components/ui/workspace';
import {toast} from '../../stores/toast-store';
import './saved-photo-recovery.css';
/** An expired request must not silently destroy its unacknowledged image. */
export function SavedPhotoRecovery(){
 const jobs=useCameraStore(state=>state.jobs),[captures,setCaptures]=useState(()=>pendingCaptures()),[discard,setDiscard]=useState<PendingCapture|null>(null),[now,setNow]=useState(Date.now());
 useEffect(()=>{const refresh=()=>{setCaptures(pendingCaptures());setNow(Date.now());};window.addEventListener('taha-pending-photos',refresh);const timer=setInterval(refresh,5000);return()=>{clearInterval(timer);window.removeEventListener('taha-pending-photos',refresh);};},[]);
 const saved=captures.filter(capture=>!jobs.some(job=>job.id===capture.requestId&&!['expired','cancelled','received'].includes(job.status)&&(!job.expiresAt||Date.parse(job.expiresAt)>now)));
 if(!saved.length)return null;
 return <section className="panel form-section"><h2>Saved photos need review</h2><p>The request is unavailable or expired. These photos are retained privately. Save a copy, then ask the counter for a new request.</p>{saved.map(capture=><div className="staff-saved-photo" key={capture.captureId}><span>Photo · {new Date(capture.createdAt).toLocaleString('en-PK',{timeZone:'Asia/Karachi'})}</span><Button onClick={()=>{if(window.TahaNative?.saveToGallery?.(capture.data))toast('Copy saved to gallery. The private original is still retained.');else toast('Could not save a gallery copy on this device. The private photo is still retained.','warning');}}>Save Copy</Button><Button variant="ghost" onClick={()=>setDiscard(capture)}>Discard</Button></div>)}<ConfirmDialog open={!!discard} title="Discard this unsent photo?" description="This permanently removes the retained photo. Save a copy first if you still need it." confirm="Discard Photo" onClose={()=>setDiscard(null)} onConfirm={()=>{if(discard)discardCapture(discard.requestId,discard.captureId);setDiscard(null);}}/></section>;
}
