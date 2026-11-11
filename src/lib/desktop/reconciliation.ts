import {invoke} from '@tauri-apps/api/core';
import {apiRequest} from '../api/client';
import {apiEnabled} from '../config';
import {nativeDesktop} from './runtime';
import {desktopScope,sqliteOutbox,sqliteCashRegistered} from './database';
import {useSessionStore} from '../../stores/session-store';
import type {Sale} from '../../types/demo';
export interface CashRecord {
 id:string;invoice:string;seller_id:string;seller_name:string;terminal_id:string;captured_at:string;
 tendered:number|null;change_given:number|null;collected:number|null;state:string;reason?:string;
 payload:{receipt?:Sale;input:{lines:{productId:string;quantity:number;unitPrice:number}[];customerId?:string};catalog?:unknown};
 details?:{cashReturned?:number;saleId?:string};resolver_id?:string;local?:boolean;serverRegistered?:boolean;
}
export const cashStateLabel=(state:string)=>({PENDING:'Pending Sync',SYNCING:'Syncing',POSTED:'Synced',REVIEW:'Needs Owner Review',FAILED:'Failed — Retry Available',REFUNDED:'Resolved / Refunded'}[state]??'Needs Owner Review');
export const localCashRecords=()=>nativeDesktop?invoke<CashRecord[]>('desktop_cash_records',{scope:desktopScope()}):Promise.resolve([]);
const path=()=>`/stores/${useSessionStore.getState().context?.store?.id}/sync`;
export async function cashRecords(){
 const local=await localCashRecords();
 if(!apiEnabled)return {rows:local,serverAvailable:false};
 try{
  const references=local.filter(r=>!['POSTED','REFUNDED'].includes(r.state)).map(r=>r.id);
  const remote:CashRecord[]=[];
  for(let i=0;i<Math.max(1,references.length);i+=200)remote.push(...await apiRequest<CashRecord[]>(path()+'/exceptions?ids='+references.slice(i,i+200).join(',')));
  const rows=new Map(local.map(r=>[r.id,r]));
  for(const record of remote){const own=rows.get(record.id);
   if(own?.local&&!['POSTED','REFUNDED'].includes(own.state)&&['POSTED','REFUNDED'].includes(record.state)){
    const resolution=record.state==='REFUNDED'?{state:'REFUNDED'}:await apiRequest(path()+`/exceptions/${record.id}/resolve`,{method:'POST',body:JSON.stringify({action:'retry',reason:'Recover an already committed server acknowledgment'})});
    await invoke('desktop_cash_resolution',{scope:desktopScope(),id:record.id,resolution});
   }
   rows.set(record.id,{...own,...record,payload:own?.payload??record.payload,local:own?.local,serverRegistered:true});}
  return {rows:[...rows.values()].sort((a,b)=>Date.parse(b.captured_at)-Date.parse(a.captured_at)),serverAvailable:true};
 }catch(error){if(!local.length)throw error;return{rows:local,serverAvailable:false};}
}
export async function resolveCash(record:CashRecord,action:'retry'|'refund',reason:string){
 if(!apiEnabled)throw new Error('Connect to the shop backend to reconcile collected cash.');
 if(record.local){
  const pending=(await sqliteOutbox()).find(item=>item.id===record.id);
  if(pending){await apiRequest(path()+'/cash-captures',{method:'POST',body:JSON.stringify(pending.payload)});await sqliteCashRegistered(record.id);}
 }
 const result=await apiRequest<{state:'POSTED'|'REFUNDED';sale?:Sale}>(path()+`/exceptions/${record.id}/resolve`,{method:'POST',body:JSON.stringify({action,reason,cashReturned:action==='refund'?Number(record.collected):undefined})});
 if(record.local&&nativeDesktop)await invoke('desktop_cash_resolution',{scope:desktopScope(),id:record.id,resolution:result});
 window.dispatchEvent(new Event('taha-sync-retry'));return result;
}
