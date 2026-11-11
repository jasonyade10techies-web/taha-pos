import {cacheRead,cachedRead} from '../mobile/read-cache';
import { bridgeRequest } from "./client";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import { bundledMobile } from "../mobile/runtime";
import type { StaffDevice, PairingCode } from "../../types/device-bridge";
import type { CameraJob } from "../../types/phase4b";
export const bridgeStorePath = () => {
  const store = useDeviceBridgeStore.getState().context?.store?.id;
  if (!store) throw new Error("Sign in to your shop before connecting staff devices.");
  return `/stores/${encodeURIComponent(store)}`;
};
export const deviceBridgeService = {
  request: bridgeRequest,
  async registerTerminal() {
    const state = useDeviceBridgeStore.getState();
    await bridgeRequest(`${bridgeStorePath()}/camera/terminals/register`,{method:"POST",body:JSON.stringify({terminalId:state.terminalId,name:state.terminalName})});
    useDeviceBridgeStore.setState({terminalRegistered:true,connected:true,error:""});
    window.dispatchEvent(new Event("taha-bridge-registered"));
  },
  async registerPhone() {
    const state = useDeviceBridgeStore.getState();
    const result = await bridgeRequest<{pairing?:StaffDevice|null}>(`${bridgeStorePath()}/camera/devices/register`,{method:"POST",body:JSON.stringify({deviceId:state.deviceId,name:state.deviceName,platform:bundledMobile?"Android":"Mobile Browser"})});
    useDeviceBridgeStore.setState({ownPair:result.pairing || null,connected:true,error:""});
    window.dispatchEvent(new Event("taha-bridge-registered"));
  },
  async restorePair(){const pair=await cachedRead<StaffDevice>('paired-counter');if(pair)useDeviceBridgeStore.setState({ownPair:{...pair,online:false}});},
  async devices(terminalId?:string) {
    const result = await bridgeRequest<StaffDevice[]>(`${bridgeStorePath()}/camera/devices${terminalId?`?terminalId=${encodeURIComponent(terminalId)}`:""}`);
    const ownPair=result.find(d=>d.pairedToThisDevice)||null;if(bundledMobile||location.pathname.startsWith('/mobile'))await cacheRead('paired-counter',ownPair);
    useDeviceBridgeStore.setState({devices:result,ownPair,...(ownPair?.deviceName?{deviceName:ownPair.deviceName}:{})});return result;
  },
  async heartbeat(phone:boolean) {
    const state = useDeviceBridgeStore.getState();
    await bridgeRequest(`${bridgeStorePath()}/camera/devices/heartbeat`,{method:"POST",body:JSON.stringify(phone?{deviceId:state.deviceId}:{terminalId:state.terminalId})});
    useDeviceBridgeStore.setState({lastHeartbeat:new Date().toISOString(),connected:true,error:""});
  },
  async pairing() {
    await this.registerTerminal();
    const state = useDeviceBridgeStore.getState();
    return bridgeRequest<PairingCode>(`${bridgeStorePath()}/camera/pairing`,{method:"POST",body:JSON.stringify({terminalId:state.terminalId})});
  },
  async pair(code:string,deviceName:string) {
    useDeviceBridgeStore.setState({deviceName});await this.registerPhone();
    const result=await bridgeRequest<StaffDevice>(`${bridgeStorePath()}/camera/pair`,{method:"POST",body:JSON.stringify({code,deviceName,deviceId:useDeviceBridgeStore.getState().deviceId})});
    await this.devices();await this.heartbeat(true);return result;
  },
  async rename(id:string,deviceName:string) {await bridgeRequest(`${bridgeStorePath()}/camera/devices/${id}`,{method:"PATCH",body:JSON.stringify({deviceName})});},
  async disconnect(id:string) {await bridgeRequest(`${bridgeStorePath()}/camera/devices/${id}`,{method:"DELETE"});await this.devices();},
  async resetPairing() {await bridgeRequest(`${bridgeStorePath()}/camera/pairings?terminalId=${encodeURIComponent(useDeviceBridgeStore.getState().terminalId)}`,{method:"DELETE"});await this.devices(useDeviceBridgeStore.getState().terminalId);},
  async test(id:string) {return bridgeRequest<CameraJob>(`${bridgeStorePath()}/camera/devices/${id}/test`,{method:"POST"});},
  async confirm(id:string) {return bridgeRequest<CameraJob>(`${bridgeStorePath()}/camera/jobs/${id}/confirm`,{method:"POST"});},
};
