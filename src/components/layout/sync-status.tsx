import { useNavigate } from "react-router-dom";
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { nativeDesktop } from "../../lib/desktop/runtime";
import { useSyncStore } from "../../stores/sync-store";
export function SyncStatus() {
  const state = useSyncStore(),
    navigate = useNavigate();
  if (!nativeDesktop) return null;
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
