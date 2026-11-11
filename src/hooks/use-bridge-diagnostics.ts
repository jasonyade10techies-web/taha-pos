import {useDeviceBridgeStore} from "../stores/device-bridge-store";
import {getDeviceBridgeBaseUrl} from "../lib/config";
import {bundledMobile} from "../lib/mobile/runtime";
export function useBridgeDiagnostics():Record<string,string>{
 const state=useDeviceBridgeStore();
 return {"Terminal ID":state.terminalId,"Terminal registered":state.terminalRegistered?"Yes":"No","Device ID":state.deviceId,"Authenticated User":state.context?.profile?.email||"Signed out","Backend":getDeviceBridgeBaseUrl()||"Not configured","Device Bridge":state.connected?"Connected":"Disconnected","Paired Counter":String(state.ownPair?.terminalName||state.ownPair?.terminalId||"None"),"Paired Device":bundledMobile?state.deviceName:state.devices.map(d=>d.deviceName).join(", ")||"None","Device Status":state.devices.some(d=>d.online)?"Online":"Offline",WebSocket:state.socket?"Connected":"Disconnected","Last heartbeat":state.lastHeartbeat||"Never","Last request received":state.lastRequest||"None","Last upload status":state.lastUpload||"None","Last pairing error":state.error||"None"};
}
