import {useEffect,useState} from 'react';
import {Button} from '../../components/ui/button';
type Counter={name:string;address:string};
export function NearbyCounters(){
 const [status,setStatus]=useState('idle'),[counters,setCounters]=useState<Counter[]>([]);
 useEffect(()=>{const update=(event:Event)=>{const result=(event as CustomEvent<{status:string;name?:string;address?:string}>).detail;if(!result)return;
  if(result.status==='found'&&result.name&&result.address){try{const url=new URL(result.address);if(url.protocol!=='https:'||url.username||url.password)return;const counter={name:result.name,address:url.origin};setCounters(old=>[...old.filter(item=>item.address!==counter.address),counter]);}catch{/* Invalid discovery hints never configure the connection. */}}
  else if(result.status==='lost')setCounters(old=>old.filter(item=>item.name!==result.name));
  else setStatus(result.status);
 };window.addEventListener('taha-counter-discovery',update);return()=>{window.removeEventListener('taha-counter-discovery',update);window.TahaNative?.stopDiscovery?.();};},[]);
 if(!window.TahaNative?.discoverCounters)return null;
 return <section className="nearby-counters"><h2>Nearby counters</h2><Button disabled={status==='searching'} onClick={()=>{setCounters([]);setStatus('searching');window.TahaNative?.discoverCounters?.();}}>{status==='searching'?'Looking nearby…':'Find Shop Counter'}</Button>
 {counters.map(counter=><div className="auth-notice" key={counter.address}><strong>{counter.name}</strong><p>Available nearby · verify with the QR displayed on this counter.</p><Button onClick={()=>window.dispatchEvent(new Event('taha-scan-open'))}>Scan Counter QR</Button></div>)}
 {status==='finished'&&!counters.length&&<p>No counters found. Keep both devices on the same network and scan the counter QR, or use Shop Address.</p>}{status==='blocked'&&<p>Discovery is unavailable on this network. Scan the counter QR or use Shop Address.</p>}
 </section>;
}
