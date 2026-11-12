import {apiRequest,getApiSessionRevision} from './client';
import {nativeDesktop} from '../desktop/runtime';
import {sqliteCache} from '../desktop/database';
import type {PosProductRow} from '../../types/database';
import {createRevisionPoller,type RevisionPage,type RevisionChange} from './revision-poller';
import {useCloudSyncStore} from '../../stores/cloud-sync-store';

export interface CounterUpdate {reset:boolean;resources:string[];changes:RevisionChange[]}
type Changed=(update?:CounterUpdate)=>void|Promise<void>;
type Entry={listeners:Set<Changed>;stop:()=>void};
const entries=new Map<string,Entry>(),cursors=new Map<string,string>();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One authenticated HTTPS loop per store/identity. LAN sockets stay independent. */
export function subscribeCounter(storeId:string,terminalId:string,changed:Changed,subject=terminalId){
 const listener:Changed=update=>changed(update);
 const key=`${storeId}:${subject}:${getApiSessionRevision()}`;
 let entry=entries.get(key);
 if(entry){entry.listeners.add(listener);return()=>release(key,listener);}
 const listeners=new Set<Changed>([listener]),cacheKey=`sync-cursor:${storeId}:${subject}`;
 const poller=createRevisionPoller({
  epoch:getApiSessionRevision,online:()=>navigator.onLine,visible:()=>document.visibilityState==='visible',
  loadCursor:async()=>nativeDesktop?(await sqliteCache<string>(cacheKey))||undefined:cursors.get(key),
  fetchPage:(cursor,signal,bootstrap)=>apiRequest<RevisionPage>(`/stores/${storeId}/sync/changes?after=${cursor}&bootstrap=${bootstrap?'1':'0'}`,{signal}),
  apply:async page=>{
   if(nativeDesktop){
    const ids=[...new Set(page.changes.filter(c=>['products','stock','services'].includes(c.resource)&&uuid.test(c.id)).map(c=>c.id))];
    if(page.resetRequired){
     const rows=await apiRequest<PosProductRow[]>(`/stores/${storeId}/products/pos`);
     await sqliteCache('pos-products',rows);
    }else if(ids.length){
     const rows=await apiRequest<PosProductRow[]>(`/stores/${storeId}/sync/catalog?ids=${ids.join(',')}`),old=await sqliteCache<PosProductRow[]>('pos-products',undefined,true);
     if(old)await sqliteCache('pos-products',[...old.filter(p=>!ids.includes(p.id)),...rows]);
    }
   }
   const update={reset:Boolean(page.resetRequired),resources:[...new Set(page.changes.map(c=>c.resource))],changes:page.changes};
   await Promise.all([...listeners].map(listener=>listener(update)));
  },
  saveCursor:async cursor=>{if(nativeDesktop)await sqliteCache(cacheKey,cursor);cursors.set(key,cursor);if(cursors.size>50)cursors.delete(cursors.keys().next().value!);},
  // Refresh identity only after persisting the cursor. Otherwise a context
  // replacement could replay the permission event forever.
  committed:page=>{if(page.changes.some(change=>['permissions','employees'].includes(change.resource)))window.dispatchEvent(new Event('taha-session-refresh'));},
  state:status=>useCloudSyncStore.setState(status==='connected'?{status,lastSuccess:Date.now()}:{status}),
 });
 const kick=()=>poller.kick(),pause=()=>poller.pause(),resume=()=>poller.resume();
 const visibility=()=>document.visibilityState==='visible'?resume():kick();
 window.addEventListener('taha-remote-changed',kick);
 window.addEventListener('taha-sync-retry',resume);window.addEventListener('online',resume);window.addEventListener('taha-app-pause',pause);window.addEventListener('taha-app-resume',resume);window.addEventListener('offline',pause);document.addEventListener('visibilitychange',visibility);
 entry={listeners,stop:()=>{poller.stop();window.removeEventListener('taha-remote-changed',kick);window.removeEventListener('taha-sync-retry',resume);window.removeEventListener('online',resume);window.removeEventListener('taha-app-pause',pause);window.removeEventListener('taha-app-resume',resume);window.removeEventListener('offline',pause);document.removeEventListener('visibilitychange',visibility);}};
 entries.set(key,entry);poller.start();
 return()=>release(key,listener);
}
function release(key:string,changed:Changed){const entry=entries.get(key);if(!entry)return;entry.listeners.delete(changed);if(entry.listeners.size===0){entry.stop();entries.delete(key);}}
