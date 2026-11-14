import "../../components/devices/android-downloads.css";
import {useEffect,useState} from 'react';
import {Button} from '../../components/ui/button';
import {nativeInfo,bundledMobile} from '../../lib/mobile/runtime';
import {useCartStore} from '../../stores/cart-store';
import {useSessionStore} from '../../stores/session-store';
import type {AndroidRelease} from '../../../distribution/manifest.mjs';
type Status={state:string;currentVersionName?:string;currentVersionCode?:number;origin?:string;configuredOrigin?:string;latest?:AndroidRelease;bytesDownloaded?:number;totalBytes?:number;error?:string};
function readStatus():Status{try{return JSON.parse(window.TahaNative?.updateStatus?.()||'{"state":"not-configured"}');}catch{return {state:'error'};}}
const labels:Record<string,string>={idle:'Ready to check', 'not-configured':'Set the download website',checking:'Checking for updates…',current:'Your app is up to date',available:'An update is available',incompatible:'This update is not compatible with this app or shop',downloading:'Downloading and verifying…',downloaded:'Update verified and ready to install','permission-required':'Allow Taha Staff to install updates, then tap Install again','installer-opened':'Follow Android’s installation instructions',cancelled:'Update cancelled',error:'Could not complete the update. Check the connection and retry.'};
export function AppUpdatesPage(){
 const [status,setStatus]=useState<Status>(readStatus),[origin,setOrigin]=useState(()=>readStatus().configuredOrigin||''),[invalid,setInvalid]=useState(false);
 const hasCart=useCartStore(s=>s.items.length>0),checkout=useSessionStore(s=>s.checkoutOpen),native=window.TahaNative;
 useEffect(()=>{const change=(event:Event)=>setStatus((event as CustomEvent<Status>).detail);window.addEventListener('taha-app-update',change);native?.checkUpdates?.(1);return()=>window.removeEventListener('taha-app-update',change);},[native]);
 return <main className="staff-page app-updates-page"><a href={bundledMobile?'#/mobile/settings':'/mobile/settings'}>← Settings</a><h1>App Updates</h1><p>Taha Staff {status.currentVersionName||nativeInfo().version||'browser'}{status.currentVersionCode?` · Build ${status.currentVersionCode}`:''}</p>
 {!native?.updateStatus?<p>App installation is managed by Android. <a href="/downloads/taha-staff">Open downloads</a></p>:<>
 <section className="panel"><h2>{labels[status.state]||'Update status unavailable'}</h2>{status.latest&&<><p>{status.latest.versionName} · Build {status.latest.versionCode}</p><ul>{status.latest.releaseNotes.map((note,index)=><li key={index}>{note}</li>)}</ul></>}
 {status.state==='downloading'&&<progress max={status.totalBytes||1} value={status.bytesDownloaded||0} aria-label="Update download"/>}
 <div className="dialog-actions"><Button disabled={['checking','downloading'].includes(status.state)} onClick={()=>native.checkUpdates?.(1)}>Check for Updates</Button>{status.state==='available'&&<Button variant="primary" onClick={()=>native.downloadUpdate?.()}>Download Update</Button>}{['downloaded','permission-required','installer-opened'].includes(status.state)&&<Button variant="primary" disabled={hasCart||checkout} onClick={()=>native.installUpdate?.()}>Install Update</Button>}{['checking','downloading'].includes(status.state)&&<Button onClick={()=>native.cancelUpdate?.()}>Cancel</Button>}</div>
 {(hasCart||checkout)&&<p>Finish or clear your current sale before installing.</p>}{status.error==='INSTALL_BUSY'&&<p>Close the camera or scanner before installing.</p>}<p>Your installed app remains usable if the update website is offline. Android always asks before installation. Keep the app installed to retain compatible data.</p></section>
 <section className="panel"><h2>Download Website</h2><p>Use the HTTPS address supplied by your owner. Leave blank to use your HTTPS shop address.</p><label htmlFor="update-origin">Website address</label><input id="update-origin" className="input" type="url" placeholder="https://your-download-site.example" value={origin} onChange={event=>setOrigin(event.target.value)} autoCapitalize="none" autoCorrect="off"/><Button onClick={()=>{const ok=native.configureUpdates?.(origin.trim());setInvalid(!ok);if(ok)native.checkUpdates?.(1);}}>Save Address</Button>{invalid&&<p role="alert">Enter an HTTPS website origin without a path, password or query.</p>}{status.origin&&<p>Checking {status.origin}</p>}</section>
 </>}
 </main>;
}
