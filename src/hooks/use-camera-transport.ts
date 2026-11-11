import {useEffect} from "react";
import {deviceBridgeConfigured} from "../lib/config";
import {bundledMobile} from "../lib/mobile/runtime";
import {cameraService} from "../lib/camera-service";
import {useCameraStore} from "../stores/camera-store";
import {subscribeDeviceBridge} from "../lib/device-bridge/realtime";
import {useDeviceBridgeStore} from "../stores/device-bridge-store";
import {cacheRead} from '../lib/mobile/read-cache';
type Watch={refs:number;queues:number;close:()=>void};const watchers=new Map<string,Watch>();
/** One connection/poller per counter, shared by all image fields. */
export function useCameraTransport(terminalId:string,queue=false){const store=useDeviceBridgeStore(s=>s.context?.store?.id),employee=useDeviceBridgeStore(s=>s.context?.profile?.id),auth=useDeviceBridgeStore(s=>s.auth);
 useEffect(()=>{
  if(!deviceBridgeConfigured||!store||auth!=="signed-in")return;const key=`${store}:${employee}:${terminalId}`;let watcher=watchers.get(key);
  if(!watcher){let active=true,busy=false,foreground=true,timer:ReturnType<typeof setTimeout>;const entry:Watch={refs:0,queues:0,close:()=>{}};
   const hasActive=()=>useCameraStore.getState().jobs.some(j=>j.terminalId===terminalId&&!['received','failed','expired','cancelled'].includes(j.status)&&(!j.expiresAt||Date.parse(j.expiresAt)>Date.now()));
   const poll=async()=>{if(!active||busy||!foreground||!navigator.onLine)return;busy=true;const known=useCameraStore.getState().jobs.filter(j=>j.terminalId===terminalId);try{const jobs=await cameraService.list(terminalId);if(active){jobs.forEach(j=>useCameraStore.getState().receive(j));if(bundledMobile&&entry.queues)void cacheRead('camera-jobs',jobs.map(j=>({...j,qrPayload:undefined,imageDataUrl:undefined,captures:j.captures?.map(c=>({...c,imageUrl:'',thumbnailUrl:undefined}))})));if(entry.queues){const visible=new Set(jobs.map(j=>j.id));for(const job of known)if(!visible.has(job.id)&&!['received','cancelled','expired'].includes(job.status))useCameraStore.getState().receive({...job,status:'cancelled'});}}}catch{/* Keep the local capture for retry; the connection strip reports network errors. */}finally{busy=false;}};
   const loop=()=>{if(!active)return;if(hasActive()||entry.queues)void poll();timer=setTimeout(loop,hasActive()?1000:5000);};
   const disconnect=subscribeDeviceBridge(store,terminalId,bundledMobile||queue,update=>{if(update?.status==='cancelled'&&update.terminalId===terminalId){const job=useCameraStore.getState().jobs.find(j=>j.id===update.id);if(job)useCameraStore.getState().receive({...job,status:'cancelled'});}if((update?.event?.startsWith('device.')||update?.event==='pairing.completed'))window.dispatchEvent(new Event('taha-bridge-devices'));void poll();}),unsubscribe=useCameraStore.subscribe(()=>{if(hasActive())void poll();});
   const pause=()=>{foreground=false;},resume=()=>{foreground=document.visibilityState==='visible';if(foreground)void poll();};window.addEventListener('taha-app-pause',pause);window.addEventListener('taha-app-resume',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
   entry.close=()=>{active=false;clearTimeout(timer);disconnect();unsubscribe();window.removeEventListener('taha-app-pause',pause);window.removeEventListener('taha-app-resume',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};watcher=entry;watchers.set(key,entry);void poll();loop();
  }
  watcher.refs++;if(queue)watcher.queues++;const entry=watcher;return()=>{entry.refs--;if(queue)entry.queues--;if(!entry.refs){entry.close();watchers.delete(key);}};
 },[terminalId,queue,store,employee,auth]);
}
