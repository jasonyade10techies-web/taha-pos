import {useEffect,useRef,useState} from 'react';
import {Dialog} from '../../components/ui/dialog';
import {Button} from '../../components/ui/button';
import {apiRequest,acceptCompanionSession,ApiError} from '../../lib/api/client';
import {useShopConnectionStore} from '../../stores/shop-connection-store';
import {useSessionStore} from '../../stores/session-store';
import {useMobilePreferences} from '../../stores/mobile-preferences-store';
import type {SessionContext} from '../../types/auth';

/** Only native code imports the QR pin and signs using the installation's private key. */
export function CompanionEnrollment(){
 const [open,setOpen]=useState(false),[message,setMessage]=useState(''),[fingerprint,setFingerprint]=useState(''),[error,setError]=useState('');const generation=useRef(0);
 useEffect(()=>{
  let alive=true;
  const receive=(event:Event)=>{
   const run=++generation.current;setOpen(true);setError('');setFingerprint('');setMessage('Opening a protected connection to the counter…');
   void(async()=>{
    if(!window.TahaNative?.beginEnrollment||!window.TahaNative.completeEnrollment)throw new Error('Passwordless connection requires the updated Taha Staff Android app.');
    const pending=JSON.parse(window.TahaNative.beginEnrollment((event as CustomEvent<string>).detail));
    if(!pending.id||!pending.shop||!pending.body)throw new Error('This connection code is invalid or expired. Generate a fresh QR on the PC.');
    useShopConnectionStore.getState().reset();
    if(!await useShopConnectionStore.getState().connect(pending.shop))throw new Error('Cannot reach the protected counter. Check same Wi-Fi/hotspot, the HTTPS listener and Windows Firewall.');
    if(!alive||run!==generation.current)return;
    const result=await apiRequest<{fingerprint:string}>(`/auth/enrollment/${pending.id}/request`,{method:'POST',body:JSON.stringify(pending.body)},false);
    setFingerprint(result.fingerprint);setMessage('On the PC, compare this identity and approve this phone. Camera requests only; sales require a staff account.');
    const expires=Date.now()+120000;
    while(alive&&run===generation.current&&Date.now()<expires){
     await new Promise(resolve=>setTimeout(resolve,2000));if(!alive||run!==generation.current)return;
     const body=window.TahaNative.completeEnrollment(pending.id,pending.challenge);
     try{
      const session=await apiRequest<{accessToken:string;context:SessionContext}>(`/auth/enrollment/${pending.id}/complete`,{method:'POST',body},false);
      if(!alive||run!==generation.current){window.TahaNative.clearSession?.();return;}
      const context=acceptCompanionSession(session);useSessionStore.getState().applyContext(context);useMobilePreferences.setState({verifiedSession:true});
      useShopConnectionStore.setState({terminalId:pending.body.terminalId});setOpen(false);location.hash='/mobile/activity';return;
     }catch(cause){if(!(cause instanceof ApiError&&cause.status===403))throw cause;}
    }
    if(alive&&run===generation.current)throw new Error('Owner approval timed out. Generate and scan a new QR.');
   })().catch(cause=>{if(alive&&run===generation.current)setError(cause instanceof Error?cause.message:'Could not connect this phone.');});
  };
  window.addEventListener('taha-enrollment-qr',receive);return()=>{alive=false;window.removeEventListener('taha-enrollment-qr',receive);};
 },[]);
 return <Dialog open={open} onOpenChange={value=>{if(!value){++generation.current;window.TahaNative?.clearSession?.();}setOpen(value);}} title="Connect this phone" description="Taha Staff · protected device enrollment"><p role="status">{message}</p>{fingerprint&&<p>Device identity: <strong>{fingerprint.slice(0,16)}</strong></p>}{error&&<p role="alert" className="text-danger">{error}</p>}<Button onClick={()=>{++generation.current;window.TahaNative?.clearSession?.();setOpen(false);}}>Cancel</Button></Dialog>;
}
