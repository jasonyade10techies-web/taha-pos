import { useNavigate } from "react-router-dom";
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { nativeDesktop } from "../../lib/desktop/runtime";
import { useSyncStore } from "../../stores/sync-store";
import {useCloudSyncStore} from '../../stores/cloud-sync-store';
import {apiEnabled} from '../../lib/config';
export function SyncStatus() {
  const state = useSyncStore(),
    navigate = useNavigate();
  const cloud=useCloudSyncStore();
  if (!nativeDesktop) {
    if(!apiEnabled||cloud.status==='connected'||cloud.status==='connecting'||cloud.status==='paused'&&navigator.onLine)return null;
    const verify=['authentication-required','forbidden'].includes(cloud.status);
    return <button className="sync-status offline" aria-label={verify?'Verify shop access':'Retry shop connection'} onClick={()=>window.dispatchEvent(new Event(verify?'taha-session-refresh':'taha-sync-retry'))}><CloudOff size={15}/><span>{verify?'Verify access':navigator.onLine?'Reconnecting…':'Offline'}</span></button>;
  }
  const Icon =
    state.status === "OFFLINE"
      ? CloudOff
      : state.status === "SYNCING"
        ? RefreshCw
        : state.status === "SYNC ERROR"
          ? AlertTriangle
          : Cloud;
  return (
    <button
      className={
        "sync-status " + state.status.toLowerCase().replaceAll(" ", "-")
      }
      onClick={() => navigate("/settings?section=Synchronization")}
      aria-label="Open Synchronization"
    >
      <Icon size={15} />
      <span>
        {state.status === "ONLINE"
          ? "Online"
          : state.status === "OFFLINE"
            ? "Offline"
            : state.status === "SYNCING"
              ? "Syncing…"
              : state.pending.length + " pending"}
      </span>
    </button>
  );
}
