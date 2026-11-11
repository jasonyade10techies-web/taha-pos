import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "../../hooks/use-network-status";
import { Badge } from "../ui/badge";
import { localDemoEnabled } from "../../lib/config";
import {nativeDesktop} from '../../lib/desktop/runtime';

export function NetworkStatus({ sidebar = false }: { sidebar?: boolean }) {
  const { online } = useNetworkStatus();
  return sidebar ? (
    <span className={`sidebar-network ${online ? "" : "is-offline"}`}>
      <i />
      {online ? "Online" : "Offline"}
    </span>
  ) : (
    <Badge tone={online ? "success" : "offline"} dot>
      {online ? "Online" : "Offline"}
    </Badge>
  );
}
export function OfflineBanner() {
  const { online, simulated } = useNetworkStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={18} />
      <div>
        <strong>OFFLINE MODE</strong>
        <span>
          {nativeDesktop ? 'Cash sales and receipts are saved locally. Pending changes synchronize when the shop connection returns.' : localDemoEnabled
            ? "Saved on this device. Synchronization is not enabled in the local prototype."
            : "Backend writes need a connection. Please reconnect."}
        </span>
        <small>
          {simulated ? "Preview mode" : "Offline"}
          {!nativeDesktop&&!localDemoEnabled &&
            " · Offline synchronization is not enabled."}
        </small>
      </div>
    </div>
  );
}
