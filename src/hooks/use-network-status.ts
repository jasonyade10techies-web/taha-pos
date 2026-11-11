import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/session-store";
import {nativeDesktop} from '../lib/desktop/runtime';
import {useSyncStore} from '../stores/sync-store';

export function useNetworkStatus() {
  const [connected, setConnected] = useState(navigator.onLine);
  const simulatedOffline = useSessionStore((s) => s.simulatedOffline);
  const nativeOffline=useSyncStore(s=>nativeDesktop&&s.status==='OFFLINE');
  useEffect(() => {
    const update = () => setConnected(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return {
    online: connected && !simulatedOffline&&!nativeOffline,
    simulated: simulatedOffline,
  };
}
