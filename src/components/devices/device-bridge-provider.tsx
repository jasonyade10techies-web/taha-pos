import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { deviceBridgeConfigured } from "../../lib/config";
import { bundledMobile } from "../../lib/mobile/runtime";
import { restoreBridgeSession, sharedBridgeSession } from "../../lib/device-bridge/client";
import { deviceBridgeService } from "../../lib/device-bridge/service";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import { useSessionStore } from "../../stores/session-store";
import { useCameraStore } from "../../stores/camera-store";
import { useCameraTransport } from "../../hooks/use-camera-transport";
import { PairStaffPhoneDialog } from "./pair-staff-phone-dialog";
import { Dialog } from "../ui/dialog";
import { MobileCaptureCard } from "../../features/pos/mobile-capture-card";

export function DeviceBridgeProvider({children}:{children:ReactNode}) {
  const location=useLocation(),businessContext=useSessionStore(s=>s.context);
  const bridge=useDeviceBridgeStore(),phoneSeen=useRef(bundledMobile);
  if((location.pathname==="/mobile-camera"||location.pathname.startsWith("/mobile")))phoneSeen.current=true;
  const phone=phoneSeen.current,terminal=phone?(bridge.ownPair?.terminalId||new URLSearchParams(location.search).get("terminal")||bridge.terminalId):bridge.terminalId;
  const [pairOpen,setPairOpen]=useState(false),[incoming,setIncoming]=useState<string|null>(null);
  const shown=useRef(new Set<string>()),jobs=useCameraStore(s=>s.jobs);
  useCameraTransport(terminal,phone);
  useEffect(()=>{const pair=()=>setPairOpen(true);window.addEventListener("taha-pair-phone",pair);return()=>window.removeEventListener("taha-pair-phone",pair);},[]);
  useEffect(()=>{
    if(phone)void deviceBridgeService.restorePair();
    if(!deviceBridgeConfigured){useDeviceBridgeStore.setState({auth:"signed-out"});return;}
    if(sharedBridgeSession()&&!businessContext){useDeviceBridgeStore.setState({context:null,auth:"signed-out"});return;}
    void restoreBridgeSession();
  },[businessContext,phone]);
  useEffect(()=>{
    if(bridge.auth!=="signed-in"||!bridge.context)return;
    let active=true,busy=false,ready=false;
    const refresh=async()=>{if(!active||busy||document.visibilityState!=="visible"||!navigator.onLine)return;busy=true;
      try{if(!ready){if(phone)await deviceBridgeService.registerPhone();else await deviceBridgeService.registerTerminal();ready=true;
        // Previous tab-only requests cannot represent devices on the shop bridge.
        useCameraStore.setState({jobs:useCameraStore.getState().jobs.filter(j=>!j.ownerInstanceId||!j.imageDataUrl?.startsWith("data:"))});
      }await deviceBridgeService.devices(phone?undefined:terminal);await deviceBridgeService.heartbeat(phone);
      }catch(cause){if(active)useDeviceBridgeStore.setState({connected:false,error:cause instanceof Error?cause.message:"Could not connect staff devices."});}finally{busy=false;}};
    const offline=()=>useDeviceBridgeStore.setState({connected:false,socket:false});
    void refresh();const timer=setInterval(()=>void refresh(),10000);
    window.addEventListener("taha-bridge-devices",refresh);window.addEventListener("taha-app-resume",refresh);window.addEventListener("online",refresh);window.addEventListener("offline",offline);document.addEventListener("visibilitychange",refresh);
    return()=>{active=false;clearInterval(timer);window.removeEventListener("taha-bridge-devices",refresh);window.removeEventListener("taha-app-resume",refresh);window.removeEventListener("online",refresh);window.removeEventListener("offline",offline);document.removeEventListener("visibilitychange",refresh);};
  },[bridge.auth,bridge.context,phone,terminal]);
  useEffect(()=>{
    if(!phone||location.pathname==="/mobile-camera"||location.pathname==="/mobile/activity")return;
    const next=jobs.find(j=>j.terminalId===terminal&&!j.diagnostic&&!['received','cancelled','expired'].includes(j.status)&&(!j.expiresAt||Date.parse(j.expiresAt)>Date.now())&&!shown.current.has(j.id));
    if(next&&!incoming){shown.current.add(next.id);setIncoming(next.id);useDeviceBridgeStore.setState({lastRequest:new Date().toISOString()});}
  },[jobs,terminal,phone,location.pathname,incoming]);
  // The Requests page owns its sheet; do not stack a second global sheet while routing from login.
  const incomingJob=(location.pathname==="/mobile-camera"||location.pathname==="/mobile/activity")?undefined:jobs.find(j=>j.id===incoming);
  return <>{children}<PairStaffPhoneDialog open={pairOpen} onOpenChange={setPairOpen}/><Dialog open={!!incomingJob} onOpenChange={open=>{if(!open)setIncoming(null);}} title={incomingJob?.type==="connection-test"?"Connection Test":"Photo Request"} description="Taha Mobiles · Main Counter">{incomingJob&&<MobileCaptureCard job={incomingJob} onClose={()=>setIncoming(null)}/>}</Dialog></>;
}

