import {useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {Button} from '../../components/ui/button';
import {ConfirmDialog} from '../../components/ui/workspace';
import {nativeDesktop} from '../../lib/desktop/runtime';
import {useCartStore} from '../../stores/cart-store';
import {useSessionStore} from '../../stores/session-store';
import {useSyncStore} from '../../stores/sync-store';

export function WindowsUpdates(){
 const owner=useSessionStore(s=>s.profile?.role==='owner'),items=useCartStore(s=>s.items.length),sync=useSyncStore();
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[available,setAvailable]=useState(false),[ready,setReady]=useState(false),[confirm,setConfirm]=useState(false);
 if(!nativeDesktop)return null;
 const blocked=items>0||sync.pending.length>0||sync.status==='SYNCING';
 async function run(command:string){
  setBusy(true);setStatus('');
  try{
   const result=await invoke<{available?:boolean;version?:string;ready?:boolean}>(command);
   if(command==='desktop_update_check'){setAvailable(!!result.available);setReady(false);setStatus(result.available?`Version ${result.version} is available.`:'This installation is up to date.');}
   else{setReady(!!result.ready);setStatus(`Version ${result.version} downloaded and signature verified.`);}
  }catch(cause){setStatus(typeof cause==='string'?cause:'The update service could not complete this request. Try again later.');}
  finally{setBusy(false);}
 }
 return <div className="mt-4"><h4>Application updates</h4><p className="text-muted">Approved releases are verified using the installed signing identity. Installation restarts Taha POS and retains local shop data.</p>
  <Button disabled={busy} onClick={()=>void run('desktop_update_check')}>{busy?'Checking release…':'Check for Updates'}</Button>
  {available&&owner&&<Button disabled={busy||blocked} onClick={()=>void run('desktop_update_download')}>Download Signed Update</Button>}
  {ready&&owner&&<Button disabled={busy||blocked} onClick={()=>setConfirm(true)}>Install and Restart</Button>}
  {blocked&&available&&<p>Finish or clear the current sale and synchronize pending changes before updating.</p>}
  {status&&<p role="status">{status}</p>}
  <ConfirmDialog open={confirm} title="Install signed update?" description="Taha POS will close and open its installer. Keep your local application data when updating." confirm="Install and Restart" onClose={()=>setConfirm(false)} onConfirm={()=>{setBusy(true);void invoke('desktop_update_install',{confirmed:true}).catch(cause=>{setStatus(typeof cause==='string'?cause:'The installer could not start.');setBusy(false);setConfirm(false);});}}/>
 </div>;
}
