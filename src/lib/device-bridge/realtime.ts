import { io } from "socket.io-client";
import { getDeviceBridgeBaseUrl } from "../config";
import { bridgeToken, bridgeCounterToken } from "./client";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import {bridgeRequest} from './client';
export type BridgeEvent = {id?:string;terminalId?:string;status?:string;assignmentState?:string;deviceId?:string;event?:string};
export function subscribeDeviceBridge(storeId:string,terminalId:string,phone:boolean,changed:(event?:BridgeEvent)=>void) {
  const base=getDeviceBridgeBaseUrl(),origin=base.startsWith("/")?location.origin:new URL(base).origin;
  // Managed cloud hosting correctness does not depend on incoming WebSockets.
  if(origin.startsWith('https:') || import.meta.env.VITE_DEPLOYMENT_ENV==='staging' || import.meta.env.VITE_DEPLOYMENT_ENV==='production'){let stopped=false,busy=false,timer:ReturnType<typeof setTimeout>;const poll=async()=>{if(stopped||busy)return;busy=true;try{await bridgeRequest(`/stores/${storeId}/camera/devices${phone?'':`?terminalId=${terminalId}`}`);changed();useDeviceBridgeStore.setState({connected:true});}catch{useDeviceBridgeStore.setState({connected:false});}finally{busy=false;if(!stopped)timer=setTimeout(()=>void poll(),document.visibilityState==='visible'?4000:30000);}};const resume=()=>{clearTimeout(timer);void poll();};void poll();window.addEventListener('taha-app-resume',resume);window.addEventListener('online',resume);return()=>{stopped=true;clearTimeout(timer);window.removeEventListener('taha-app-resume',resume);window.removeEventListener('online',resume);};}
  const socket=io(`${origin}/counter`,{auth:cb=>cb({accessToken:bridgeToken(),counterToken:bridgeCounterToken()}),withCredentials:true,transports:["websocket"],reconnectionDelay:1000,reconnectionDelayMax:10000});
  let retry:ReturnType<typeof setTimeout>|undefined,closed=false;
  const subscribe=()=>{if(closed||!socket.connected)return;if(retry)clearTimeout(retry);socket.timeout(4000).emit("subscribe",{storeId,terminalId:phone?undefined:terminalId,deviceId:phone?useDeviceBridgeStore.getState().deviceId:undefined},(error:unknown,result?:{ok:boolean})=>{if(closed)return;const ok=!error&&result?.ok===true;useDeviceBridgeStore.setState({socket:ok});if(ok)changed();else retry=setTimeout(subscribe,2000);});};
  socket.on("connect",subscribe);
  socket.on("disconnect",()=>useDeviceBridgeStore.setState({socket:false}));
  socket.on("connect_error",()=>useDeviceBridgeStore.setState({socket:false}));
  const names=["camera.requested","camera.completed","camera.updated","camera.request.created","camera.request.completed","camera.assignment.changed","device.pairing.created","device.pairing.completed","pairing.completed","device.online","device.offline","device.unpaired","device.renamed"];
  for(const name of names)socket.on(name,(value:BridgeEvent)=>changed({...value,event:name}));
  const authenticate=()=>{socket.disconnect();if(bridgeToken())socket.connect();};
  const resume=()=>{if(document.visibilityState==="visible"&&bridgeToken()){if(!socket.connected)socket.connect();changed();}};
  const pause=()=>socket.disconnect();
  window.addEventListener("taha-bridge-auth",authenticate);window.addEventListener("taha-api-token",authenticate);
  window.addEventListener("taha-bridge-registered",subscribe);
  window.addEventListener("taha-app-pause",pause);window.addEventListener("taha-app-resume",resume);window.addEventListener("online",resume);document.addEventListener("visibilitychange",resume);
  return()=>{closed=true;if(retry)clearTimeout(retry);window.removeEventListener("taha-bridge-registered",subscribe);window.removeEventListener("taha-bridge-auth",authenticate);window.removeEventListener("taha-api-token",authenticate);window.removeEventListener("taha-app-pause",pause);window.removeEventListener("taha-app-resume",resume);window.removeEventListener("online",resume);document.removeEventListener("visibilitychange",resume);socket.disconnect();};
}
