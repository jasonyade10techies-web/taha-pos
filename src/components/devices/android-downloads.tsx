import "./android-downloads.css";
import {useQuery} from '@tanstack/react-query';
import {QRCodeSVG} from 'qrcode.react';
import {Download,Smartphone} from 'lucide-react';
import {useState} from 'react';
import {validateRelease} from '../../../distribution/manifest.mjs';
import {Button} from '../ui/button';
export function AndroidDownloads({compact=false}:{compact?:boolean}){
 const [qr,setQr]=useState(false);
 const configured=import.meta.env.VITE_ANDROID_DOWNLOAD_ORIGIN?.trim();
 let source='';try{if(configured){const value=new URL(configured);if(value.protocol==='https:'&&!value.username&&!value.password&&value.pathname==='/'&&!value.search&&!value.hash)source=value.origin;}}catch{/* Unconfigured optional distribution site. */}
 const enabled=import.meta.env.PROD||!!source;
 const query=useQuery({queryKey:['android-public-release','test',source],enabled,queryFn:async()=>{const response=await fetch(source+'/downloads/taha-staff/status?channel=test',{credentials:'omit',signal:AbortSignal.timeout(8000),cache:'no-store'});if(!response.ok)throw Error('Unavailable');const text=await response.text();if(text.length>36864)throw Error('Invalid');const status=JSON.parse(text);if(status.available===false&&status.channel==='test')return null;const release=validateRelease(status.release);if(release.channel!=='test'||status.available!==true)throw Error('Invalid');return release;},retry:false,staleTime:300000});
 const url=(source||window.location.origin)+'/downloads/taha-staff';
 return <section className={compact?'android-download-compact':'panel android-download-panel'} aria-label="Taha Staff downloads">
  <Smartphone size={18}/><div><strong>Taha Staff</strong><span>{query.data?`Test ${query.data.versionName} · build ${query.data.versionCode}`:query.isFetching?'Checking release…':'Download site not configured here'}</span></div>
  <a className="button button-secondary button-small" href={source?url:'/downloads/taha-staff'} target="_blank" rel="noreferrer"><Download size={14}/>Download App</a>
  {!compact&&<Button size="small" onClick={()=>setQr(!qr)}>Install QR</Button>}
  {qr&&<div className="android-install-qr"><QRCodeSVG value={url} size={260} bgColor="#fff" fgColor="#000" marginSize={4}/><p>Install Taha Staff · This QR opens the download page.</p><small>Phone pairing is a separate step.</small></div>}
 </section>;
}
