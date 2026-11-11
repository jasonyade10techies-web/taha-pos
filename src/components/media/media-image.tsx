import {useEffect,useState,type ImgHTMLAttributes} from "react";
import { useQuery } from "@tanstack/react-query";
import { bridgeRequest } from "../../lib/device-bridge/client";
import { bridgeStorePath } from "../../lib/device-bridge/service";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import {useSessionStore} from '../../stores/session-store';
import {apiEnabled} from '../../lib/config';
import {apiMediaUrls} from '../../lib/api/media';
import {bundledMobile} from '../../lib/mobile/runtime';
import {shopFetch} from '../../lib/mobile/transport';

/** Local business records keep an opaque private-file reference, never an expiring token or photo bytes. */
export function MediaImage({
  src,
  thumbnail = false,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { thumbnail?: boolean }) {
  const bridge = useDeviceBridgeStore(), session=useSessionStore(), [failed,setFailed]=useState<string>(),
    path =
      typeof src === "string" && src.startsWith("taha-media:")
        ? src.slice(11)
        : "";
  const apiAccess=apiEnabled&&session.authStatus==='authenticated'&&!!session.context?.store?.id;
  const canResolve=apiAccess||bridge.auth==='signed-in';
  const query = useQuery({
    queryKey: [
      "private-media",
      apiAccess?'api':'bridge',
      apiAccess?session.context?.store?.id:bridge.context?.store?.id,
      apiAccess?session.profile?.id:bridge.context?.profile?.id,
      path,
    ],
    enabled: !!path && canResolve,
    staleTime: 180000,
    refetchInterval: 240000,
    queryFn: () => apiAccess ? apiMediaUrls([path]) :
      bridgeRequest<Record<string, string>>(`${bridgeStorePath()}/media/urls`, {
        method: "POST",
        body: JSON.stringify({ paths: [path] }),
      }),
  });
  const resolved = path ? query.data?.[path] : src;
  const image =
    thumbnail &&
    typeof resolved === "string" &&
    /\/api\/v1\/media\/[a-f0-9-]{36}/i.test(resolved)
      ? resolved + (resolved.includes("?") ? "&" : "?") + "thumbnail=1"
      : resolved;
  const [nativeImage,setNativeImage]=useState<{source:string;url:string}|null>(null);
  const pinned=bundledMobile&&!!window.TahaNative?.companionSession?.()&&typeof image==='string'&&image.startsWith('https:');
  useEffect(()=>{if(!pinned||typeof image!=='string')return;let active=true,objectUrl='';void shopFetch(image).then(async response=>{if(!response.ok)throw new Error();objectUrl=URL.createObjectURL(await response.blob());if(active)setNativeImage({source:image,url:objectUrl});else URL.revokeObjectURL(objectUrl);}).catch(()=>{if(active)setFailed(image);});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[pinned,image]);
  if(!image||image===failed){
    const loading=!!path&&canResolve&&query.isPending;
    return <span className={props.className} role="img" aria-label={loading?`Loading ${props.alt??'image'}`:`${props.alt??'Image'} unavailable`} data-media-state={loading?'loading':'unavailable'} title={loading?'Loading private image…':path&&!canResolve?'Sign in to access this private image.':'The private image could not be loaded. Check the connection or replace the image.'}>{loading?'Loading image…':'Image unavailable'}</span>;
  }
  if(pinned&&nativeImage?.source!==image)return <span className={props.className} role="img" aria-label={`Loading ${props.alt??'image'}`}>Loading image…</span>;
  return <img loading="lazy" {...props} src={pinned?nativeImage?.url:image} onError={event=>{setFailed(String(image));props.onError?.(event);if(path&&canResolve)void query.refetch();}} />;
}
