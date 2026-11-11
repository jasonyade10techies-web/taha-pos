import {nativeDesktop} from './desktop/runtime';

/** Called synchronously by a user click before any asynchronous preparation. */
export function prepareExternalWindow(){
  if(nativeDesktop)return null;
  const popup=window.open('about:blank','_blank');
  if(popup)popup.opener=null;
  return popup;
}
export async function openWhatsappDestination(target:string,popup:Window|null){
  const url=new URL(target);
  if(url.protocol!=='https:'||url.hostname!=='wa.me'||url.username||url.password)throw Error('Unsupported WhatsApp destination.');
  if(nativeDesktop){const {openUrl}=await import('@tauri-apps/plugin-opener');await openUrl(url.toString());}
  else {
    if(!popup||popup.closed)throw Error('The browser blocked WhatsApp. Allow a new window or copy the message.');
    popup.location.replace(url.toString());
  }
}
