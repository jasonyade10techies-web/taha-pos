import { Laptop, Smartphone, LogOut } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { QueryState } from "../../components/ui/workspace";
import { useRepository, useAction } from "../../hooks/use-repository";
import { apiRequest } from "../../lib/api/client";
import { apiEnabled } from "../../lib/config";
type DeviceSession = { id: string; deviceName: string; createdAt: string; lastActiveAt: string; current: boolean };
export function ConnectedDevices({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useRepository("own-device-sessions", () => apiEnabled ? apiRequest<DeviceSession[]>("/auth/devices") : Promise.resolve([{ id: "local", deviceName: "This browser · Local demo", createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), current: true }]), open);
  const action = useAction();
  return <Dialog open={open} onOpenChange={onOpenChange} title="Connected Devices" description="Review your account sessions. Revoking a device signs it out of the shop application."><QueryState pending={query.isPending} error={query.isError} retry={() => void query.refetch()}><div className="device-session-list">{query.data?.map(device => <article className="device-session-card" key={device.id}>{/phone|android|mobile|iphone/i.test(device.deviceName) ? <Smartphone size={22}/> : <Laptop size={22}/>}<div><strong>{device.deviceName}</strong><p>{device.current ? "Current device" : `Last active ${new Date(device.lastActiveAt).toLocaleString()}`}</p></div>{apiEnabled && !device.current && <Button size="small" disabled={action.busy} onClick={() => void action.run(() => apiRequest(`/auth/devices/${device.id}`, { method: "DELETE" }), "Device signed out", () => void query.refetch())}><LogOut size={14}/>Sign Out Device</Button>}</article>)}</div></QueryState>{action.error && <p role="alert" className="text-danger">{action.error}</p>}</Dialog>;
}
