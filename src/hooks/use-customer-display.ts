import {quoteTax} from '../lib/tax';
import {nativeDesktop} from '../lib/desktop/runtime';
import {invoke} from '@tauri-apps/api/core';
import {listen,emitTo} from '@tauri-apps/api/event';
import type {DemoSettings} from '../types/demo';
import { useEffect, useState } from "react";
import { useCartStore } from "../stores/cart-store";
import { cartTotals, customerSnapshot } from "../lib/cart";
import type { CustomerDisplayState, DisplayPayment } from "../types/phase4b";
import { useUiStore } from "../stores/ui-store";
import {useDeviceBridgeStore} from '../stores/device-bridge-store';
import {deviceBridgeService,bridgeStorePath} from '../lib/device-bridge/service';
import {bridgeRequest} from '../lib/device-bridge/client';
import { apiEnabled } from "../lib/config";
import { remoteDisplay } from "../lib/api/customer-display";
import { useDisplayStore } from "../stores/display-store";

export const displayChannelName = "taha-pos-customer-display-v2";
const terminal = () => useUiStore.getState().terminalId;
let taxCoupons:import('../types/demo').Coupon[]=[];
let taxSettings:Pick<DemoSettings,"taxProfiles"|"defaultTaxProfileId">={};
function cartState(): CustomerDisplayState {
  const { items, couponDiscount, couponCode } = useCartStore.getState();
  const totals = cartTotals(items, couponDiscount);
  const tax=quoteTax(items,couponDiscount,taxSettings.taxProfiles,taxSettings.defaultTaxProfileId,taxCoupons.find(c=>c.code===couponCode));
  return { ...customerSnapshot(items, couponDiscount), total:tax.total,tax:{name:tax.name,rate:tax.rate,mode:tax.mode,amount:tax.amount}, mode: items.length ? "CART_ACTIVE" : "IDLE", terminalId: terminal(), couponDiscount: totals.couponDiscount, negotiatedDiscount: totals.negotiatedDiscount, couponCode };
}
let lastState: CustomerDisplayState = cartState();
let completionTimer: number | undefined;
function send(state: CustomerDisplayState, eventName = "cart.updated") {
  if(nativeDesktop&&!location.hash.includes('/customer-display'))void invoke('desktop_display_state',{snapshot:state}).catch(()=>undefined);
  window.dispatchEvent(new CustomEvent("taha-customer-display", { detail: state }));
  if (!("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel(displayChannelName);
  channel.postMessage({ type: "display-state", event: eventName, terminalId: state.terminalId, state });
  channel.close();
}
export function publishCustomerDisplay(patch: Partial<CustomerDisplayState>, event = "cart.updated") {
  lastState = { ...lastState, ...patch, terminalId: terminal() };
  send(lastState, event);
  if (patch.mode === "SALE_COMPLETE") {
    clearTimeout(completionTimer);
    completionTimer = window.setTimeout(() => resetDisplayToCart(), (lastState.config?.completeDuration ?? 12) * 1000);
  }
}
export function resetDisplayToCart() {
  clearTimeout(completionTimer);
  lastState = { ...cartState(), config: lastState.config };
  send(lastState, lastState.items.length ? "cart.updated" : "sale.cancelled");
}
export function reconnectDisplay() {
  send(lastState);
}
export function localPairingCode(terminalId: string) {
  let hash = 0;
  for (const char of terminalId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return String(hash % 1000000).padStart(6, "0");
}

/** Sanitized terminal-scoped transport. A remote authenticated transport can use the same event contract. */
export function useCustomerDisplayPublisher() {
  useEffect(() => {
    const nativeListener=nativeDesktop?listen<{terminalId:string}>('taha-display-request',event=>{useDisplayStore.getState().heartbeat('native-display');send(lastState);void event;}):null;
    // Auth may seed the cart before the shell mounts. Sample it here rather than sending module-time state.
    if (lastState.mode !== "SALE_COMPLETE") lastState = { ...cartState(), config: lastState.config };
    let disposed = false, remoteBusy = false,bridgeBusy=false;
    const refreshTax=()=>void import("../lib/repositories").then(module=>Promise.all([module.repositories.settings.get(),module.repositories.coupons.list()])).then(([settings,coupons])=>{if(disposed)return;taxSettings=settings;taxCoupons=coupons;if(lastState.mode!=="SALE_COMPLETE"){lastState={...lastState,...cartState(),mode:lastState.mode};send(lastState);}}).catch(()=>undefined);
    refreshTax();window.addEventListener("taha-remote-changed",refreshTax);
    const syncBridge=async()=>{const bridge=useDeviceBridgeStore.getState();if(disposed||bridgeBusy||bridge.auth!=='signed-in')return;bridgeBusy=true;try{if(!bridge.terminalRegistered)await deviceBridgeService.registerTerminal();await bridgeRequest(bridgeStorePath()+'/displays/preview',{method:'PUT',body:JSON.stringify({terminalId:bridge.terminalId,snapshot:{...lastState,terminalId:bridge.terminalId}})});}catch{/* Reconnect heartbeat resends the current privacy-filtered order. */}finally{bridgeBusy=false;}};
    const syncRemote = async () => {
      void syncBridge();
      if (!apiEnabled || disposed || remoteBusy) return;
      remoteBusy = true;
      try {
        const displays = await remoteDisplay.list(terminal());
        for (const display of displays) {
          if (disposed) return;
          const id = display.displaySessionId || display.id;
          if (id) await remoteDisplay.publish(id, terminal(), lastState);
          if (display.online && id) useDisplayStore.getState().heartbeat(id);
        }
      } catch { /* Retry the heartbeat; display capability expires stale order data. */ }
      finally { remoteBusy = false; }
    };
    let flush: number | undefined;
    const changed = () => { clearTimeout(flush); flush = window.setTimeout(() => void syncRemote(), 80); };
    const pairing = apiEnabled && "BroadcastChannel" in window ? new BroadcastChannel("taha-pos-display-pairing") : null;
    if (pairing) pairing.onmessage = ({data}) => {
      if (data?.terminalId === terminal() && /^[0-9A-F]{8}$/.test(data.pairingCode)) void remoteDisplay.pair(data.pairingCode,terminal()).then(syncRemote).catch(() => undefined);
    };
    window.addEventListener("taha-customer-display", changed);
    const remoteTimer = window.setInterval(() => void syncRemote(), 5000);
    const c = "BroadcastChannel" in window ? new BroadcastChannel(displayChannelName) : null;
    if (c) c.onmessage = ({ data }) => {
      if (data?.terminalId !== terminal()) return;
      if (data.type === "display-request") { useDisplayStore.getState().heartbeat(data.displaySessionId); send(lastState); }
      if (data.type === "display-heartbeat") { useDisplayStore.getState().heartbeat(data.displaySessionId); c.postMessage({type:"display-alive",terminalId:terminal()}); }
    };
    const unsubscribe = useCartStore.subscribe((next, previous) => {
      if (next.items===previous.items && next.couponCode===previous.couponCode && next.couponDiscount===previous.couponDiscount && next.customerId===previous.customerId && next.cartId===previous.cartId) return;
      if (lastState.mode === "SALE_COMPLETE" && !next.items.length) return;
      clearTimeout(completionTimer);
      const nextCart=cartState();
      const retainPayment=nextCart.items.length>0 && ['CHECKOUT','PAYMENT'].includes(lastState.mode);
      lastState = { ...nextCart,config:lastState.config,...(retainPayment ? {mode:lastState.mode,payment:lastState.payment} : {}) };
      send(lastState, !next.items.length ? "sale.cancelled" : !previous.items.length ? "cart.started" : "cart.updated");
    });
    const timer = window.setInterval(() => useDisplayStore.getState().expire(), 3000);
    send(lastState);
    return () => {void nativeListener?.then(unlisten=>unlisten());window.removeEventListener("taha-remote-changed",refreshTax);disposed = true; unsubscribe(); c?.close(); pairing?.close(); clearInterval(timer); clearInterval(remoteTimer); clearTimeout(flush); window.removeEventListener("taha-customer-display", changed); };
  }, []);
}
export function useCustomerDisplay(targetTerminal = terminal()) {
  const [state, setState] = useState<CustomerDisplayState>(() => targetTerminal === terminal() ? lastState : { mode: "IDLE", terminalId: targetTerminal, items: [], subtotal: 0, discount: 0, total: 0 });
  useEffect(() => {
    const sessionId = crypto.randomUUID();
    let lastSeen = Date.now(), received = false;
    const receive = (next: CustomerDisplayState) => { if (next?.terminalId === targetTerminal) {lastSeen=Date.now();received=true;setState(next);} };
    const nativeListener=nativeDesktop?listen<CustomerDisplayState>('taha-display-state',event=>receive(event.payload)).then(async unlisten=>{await emitTo('main','taha-display-request',{terminalId:targetTerminal});return unlisten;}):null;
    const local = (e: Event) => receive((e as CustomEvent<CustomerDisplayState>).detail);
    window.addEventListener("taha-customer-display", local);
    const c = "BroadcastChannel" in window ? new BroadcastChannel(displayChannelName) : null;
    if (c) c.onmessage = ({ data }) => { if (data?.type === "display-state") receive(data.state); if(data?.type === "display-alive" && data.terminalId===targetTerminal)lastSeen=Date.now(); };
    const heartbeat = () => {
      c?.postMessage({ type: "display-heartbeat", terminalId: targetTerminal, displaySessionId: sessionId });
      if(nativeDesktop)void emitTo('main','taha-display-request',{terminalId:targetTerminal});
      if(received && Date.now()-lastSeen>10000){received=false;setState(previous=>({mode:"IDLE",terminalId:targetTerminal,items:[],subtotal:0,discount:0,total:0,config:previous.config}));}
    };
    c?.postMessage({ type: "display-request", terminalId: targetTerminal, displaySessionId: sessionId });
    const timer = window.setInterval(heartbeat, 2500);
    return () => {void nativeListener?.then(unlisten=>unlisten());clearInterval(timer); window.removeEventListener("taha-customer-display", local); c?.close(); };
  }, [targetTerminal]);
  return state;
}
export function displayPaymentFromMethod(method: { name: string; kind: "Cash" | "Digital" | "Credit"; title?: string; number?: string; iban?: string; qr?: string }, total: number, extras?: Partial<DisplayPayment>): DisplayPayment {
  return { method: method.name, kind: method.kind, total, title: method.title, number: method.number, iban: method.iban, ...(method.qr ? {qr:method.qr} : {}), ...extras };
}
