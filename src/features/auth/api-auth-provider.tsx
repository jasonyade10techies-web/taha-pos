import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiAuth, getAccessToken, refreshApiSession } from "../../lib/api/client";
import { useSessionStore } from "../../stores/session-store";
import { useUiStore } from "../../stores/ui-store";
import { clearWorkspace } from "./session-actions";
import {bundledMobile} from "../../lib/mobile/runtime";
import {useShopConnectionStore} from "../../stores/shop-connection-store";
import {nativeDesktop} from '../../lib/desktop/runtime';
import {invoke} from '@tauri-apps/api/core';
import type {SessionContext} from '../../types/auth';
export function ApiAuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  useEffect(() => {
    let disposed = false, generation = 0;
    const refresh = async () => {
      const run = ++generation;
      try {
        const context = getAccessToken() ? await apiAuth.context() : await refreshApiSession();
        if (disposed || run !== generation) return;
        if (context?.profile?.avatar_url && context.store && !context.profile.avatar_url.startsWith("http")) {
          const path = context.profile.avatar_url;
          const urls = await apiRequest<Record<string,string>>(`/stores/${context.store.id}/media/urls`,{method:"POST",body:JSON.stringify({paths:[path]})});
          context.profile.avatar_url = urls[path] || null;
        }
        if (disposed || run !== generation) return;
        const previous = useSessionStore.getState();
        if (!context || previous.profile?.id !== context.profile?.id || previous.context?.store?.id !== context.store?.id || JSON.stringify(previous.permissions) !== JSON.stringify(context.permissions)) clearWorkspace(client);
        if (!context) { previous.resetAuth(); return; }
        previous.applyContext(context);
        if(bundledMobile&&context.store)useShopConnectionStore.setState({shopName:`${context.store.name} / ${context.store.branch_name}`});
        if (context.store) useUiStore.getState().setBranch({ id: context.store.id, name: context.store.branch_name });
      } catch { if (!disposed && run === generation) {if(nativeDesktop){try{const offline=await invoke<SessionContext>('desktop_offline_context');if(disposed||run!==generation)return;useSessionStore.getState().applyContext(offline);if(offline.store)useUiStore.getState().setBranch({id:offline.store.id,name:offline.store.branch_name});return;}catch{/* Expired/revoked offline access fails closed. */}}if(bundledMobile&&useSessionStore.getState().authStatus==="authenticated")return;clearWorkspace(client); useSessionStore.getState().resetAuth("error", "Cannot verify your access. Check your connection and retry."); } }
    };
    const expired = () => { generation++; clearWorkspace(client); useSessionStore.getState().resetAuth(); };
    const onRefresh = () => { void refresh(); };
    const resume=()=>{if(document.visibilityState==="visible")void refresh();};
    if(nativeDesktop)void invoke<SessionContext>('desktop_offline_context').then(context=>{if(!disposed&&useSessionStore.getState().authStatus==='loading')useSessionStore.getState().applyContext(context);}).catch(()=>undefined);
    void refresh(); const interval = setInterval(() => { void refreshApiSession().then(onRefresh).catch(() => undefined); }, 10 * 60_000);
    window.addEventListener("taha-session-refresh", onRefresh); window.addEventListener("taha-api-expired", expired);
    window.addEventListener("taha-app-resume",resume);window.addEventListener("online",resume);
    return () => { disposed = true; generation++; clearInterval(interval); window.removeEventListener("taha-session-refresh", onRefresh); window.removeEventListener("taha-api-expired", expired);window.removeEventListener("taha-app-resume",resume);window.removeEventListener("online",resume); };
  }, [client]);
  return children;
}
