import { useState } from "react";
import { Link } from "react-router-dom";
import { Smartphone } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { QueryState } from "../ui/workspace";
import { useRepository } from "../../hooks/use-repository";
import { bridgeRequest as apiRequest } from "../../lib/device-bridge/client";
import { bridgeStorePath as storePath } from "../../lib/device-bridge/service";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";

export type CameraDevice = { id: string; deviceId?: string; deviceName?: string; device_name?: string; online?: boolean; lastActiveAt?: string; last_seen_at?: string };

export function CameraDevicePicker({ open, onOpenChange, onSelect, busy, error }: {
  open: boolean; onOpenChange: (open: boolean) => void; onSelect: (id: string) => void; busy: boolean; error: string;
}) {
  const terminalId = useDeviceBridgeStore(s => s.terminalId);
  const [selected, setSelected] = useState("");
  const query = useRepository("camera-device-picker-" + terminalId, () => apiRequest<CameraDevice[]>(`${storePath()}/camera/devices?terminalId=${encodeURIComponent(terminalId)}`), open);
  return <Dialog open={open} onOpenChange={onOpenChange} title="Choose Staff Phone" description="Send this photo request to one phone paired with this counter.">
    <QueryState pending={query.isPending} error={query.isError} retry={() => void query.refetch()}>
      <div className="camera-device-options">{query.data?.map(device => <button type="button" className={`camera-device-option ${selected === device.id ? "selected" : ""}`} aria-pressed={selected === device.id} key={device.id} onClick={() => setSelected(device.id)}>
        <Smartphone size={22}/><span><strong>{device.deviceName || device.device_name || "Staff phone"}</strong><small>{device.online ? "Online · Ready to capture" : "Offline · Use the request QR if push is unavailable"}</small></span>
      </button>)}</div>
      {!query.data?.length && <p className="auth-notice">No phone is paired with this counter. <Link to="/settings" onClick={() => onOpenChange(false)}>Open Settings → Devices</Link> to pair a staff phone.</p>}
    </QueryState>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <div className="dialog-actions"><Button onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button><Button variant="primary" disabled={busy || !query.data?.some(d => d.id === selected)} onClick={() => onSelect(selected)}>{busy ? "Requesting…" : "Send to Phone"}</Button></div>
  </Dialog>;
}
