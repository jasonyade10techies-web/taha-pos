import {create} from "zustand";
import {persist} from "zustand/middleware";
import {mobileTestBuild} from "../lib/mobile/runtime";
import {parseShopAddress} from "../lib/mobile/address";
import {shopFetch} from "../lib/mobile/transport";
export type ConnectionStatus="unconfigured"|"connecting"|"connected"|"shop-not-reachable"|"invalid-address"|"network-blocked"|"server-error"|"authentication-required"|"timeout";
type State={baseUrl:string;attemptedUrl:string;connectionStatus:ConnectionStatus;lastSuccessfulConnection:string|null;latency:number|null;lastError:string;healthPassed:boolean;accepted:boolean;terminalId:string;shopName:string;check:(address?:string)=>Promise<boolean>;connect:(address:string)=>Promise<boolean>;reset:()=>void;markFailure:()=>void};
const checks=new Map<string,Promise<boolean>>();
let checkSequence=0,connectionGeneration=0;
export const useShopConnectionStore=create<State>()(persist((set,get)=>({
  baseUrl:"",attemptedUrl:"",connectionStatus:"unconfigured",lastSuccessfulConnection:null,latency:null,lastError:"",healthPassed:false,accepted:false,terminalId:"",shopName:"",
  async check(address=get().baseUrl){
    let origin:string;
    try{origin=parseShopAddress(address,mobileTestBuild).baseUrl;}
    catch(cause){++checkSequence;set({connectionStatus:"invalid-address",lastError:(cause as Error).message,healthPassed:false});return false;}
    const running=checks.get(origin);if(running)return running;
    const id=++checkSequence;
    const update=(patch:Partial<State>)=>{if(id===checkSequence)set(patch);};
    const task=(async()=>{
      update({attemptedUrl:origin,connectionStatus:"connecting",lastError:""});const started=performance.now();
      try{
        const response=await shopFetch(origin+"/api/v1/health",{},8000);
        if(!response.ok){update({connectionStatus:response.status===401?"authentication-required":"server-error",lastError:`Shop health check returned HTTP ${response.status}.`,healthPassed:false});return false;}
        const health=await response.json().catch(()=>null);
        if(health?.status!=="ok"||health.database!=="connected"){update({connectionStatus:"server-error",healthPassed:false,lastError:"This address is not a ready Taha API. Check the API port and database."});return false;}
        update({connectionStatus:"connected",lastSuccessfulConnection:new Date().toISOString(),latency:Math.round(performance.now()-started),lastError:"",healthPassed:true});return true;
      }catch(cause){const name=(cause as Error).name,message=(cause as Error).message;const timeout=name==="TimeoutError"||message==="TIMEOUT";
        update({connectionStatus:timeout?"timeout":message==="NETWORK_BLOCKED"?"network-blocked":"shop-not-reachable",lastError:timeout?"The shop did not respond within 8 seconds.":"Cannot reach the shop API. Check the server, Wi-Fi and Windows Firewall.",healthPassed:false});return false;}
    })().finally(()=>{if(checks.get(origin)===task)checks.delete(origin);});checks.set(origin,task);return task;
  },
  async connect(address){const generation=connectionGeneration;if(!await get().check(address)||generation!==connectionGeneration)return false;const baseUrl=parseShopAddress(address,mobileTestBuild).baseUrl;
    if(window.TahaNative&&!window.TahaNative.configure(baseUrl)){set({connectionStatus:"network-blocked",lastError:"This build does not allow this shop address.",healthPassed:false});return false;}
    ++checkSequence;++connectionGeneration;
    if(baseUrl!==get().baseUrl){window.dispatchEvent(new Event("taha-api-expired"));window.dispatchEvent(new Event("taha-shop-changed"));}
    set({baseUrl,attemptedUrl:baseUrl,accepted:true,connectionStatus:"connected",healthPassed:true,lastError:""});window.dispatchEvent(new Event("taha-session-refresh"));return true;
  },
  reset(){++checkSequence;++connectionGeneration;checks.clear();window.dispatchEvent(new Event("taha-shop-changed"));window.dispatchEvent(new Event("taha-api-expired"));set({baseUrl:"",attemptedUrl:"",accepted:false,connectionStatus:"unconfigured",lastError:"",healthPassed:false,terminalId:"",shopName:""});},
  markFailure(){set({connectionStatus:"shop-not-reachable",healthPassed:false,lastError:"Connection interrupted. Retry or check Diagnostics."});},
}),{name:"taha-shop-connection",partialize:s=>({baseUrl:s.baseUrl,lastSuccessfulConnection:s.lastSuccessfulConnection,terminalId:s.terminalId,shopName:s.shopName})}));
