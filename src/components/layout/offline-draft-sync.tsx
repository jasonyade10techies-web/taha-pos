import {useEffect,useState} from 'react';
import {useSessionStore} from '../../stores/session-store';
import {localDemoEnabled} from '../../lib/config';
import {syncProductDrafts} from '../../lib/product-drafts';
export function OfflineDraftSync(){
 const profile=useSessionStore(state=>state.profile),[cached,setCached]=useState(false);
 useEffect(()=>{if(localDemoEnabled||!profile)return;const run=()=>{if(navigator.onLine){setCached(false);void syncProductDrafts();}};const stale=()=>setCached(true);run();window.addEventListener('online',run);window.addEventListener('taha-cached-read',stale);const timer=setInterval(run,60000);return()=>{window.removeEventListener('online',run);window.removeEventListener('taha-cached-read',stale);clearInterval(timer);};},[profile]);
 return cached?<div className="cached-data-notice" role="status">Cached shop data · reconnect to refresh stock. Unsaved product drafts remain Pending Sync.</div>:null;
}
