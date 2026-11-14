import {AndroidDownloads} from "../../components/devices/android-downloads";
import {useShopConfiguration} from "../../hooks/use-shop-configuration";
import {CompanionEnrollmentSettings} from './companion-enrollment-settings';
import { useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Monitor, Pencil, RefreshCw, Send, Smartphone, Unplug } from "lucide-react";
import { deviceBridgeService } from "../../lib/device-bridge/service";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import { useCameraStore } from "../../stores/camera-store";
import type { StaffDevice } from "../../types/device-bridge";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { ConfirmDialog } from "../../components/ui/workspace";

function lastSeen(device: StaffDevice) {
  const value = device.lastActiveAt || device.lastSeen;
  if (!value) return "Not yet available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet available" : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function DevicesSettings() {
  const {ownerOnly}=useShopConfiguration();
  const allDevices = useDeviceBridgeStore(state => state.devices);
  const terminalId = useDeviceBridgeStore(state => state.terminalId);
  const terminalName = useDeviceBridgeStore(state => state.terminalName);
  const auth = useDeviceBridgeStore(state => state.auth);
  const devices = allDevices.filter(device => device.terminalId === terminalId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [testId,setTestId]=useState<string|null>(null);
  const testJob=useCameraStore(state=>state.jobs.find(job=>job.id===testId));
  const [disconnect, setDisconnect] = useState<StaffDevice | null>(null);
  const [reset, setReset] = useState(false);
  const [rename, setRename] = useState<StaffDevice | null>(null);
  const [name, setName] = useState("");
  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); if (success) setMessage(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not complete the request. Check the shop connection and try again."); }
    finally { setBusy(false); }
  }
  const pair = () => window.dispatchEvent(new Event("taha-pair-phone"));
  const refresh = async () => { await deviceBridgeService.devices(terminalId); };
  return <div className="devices-settings device-bridge-settings">
    <AndroidDownloads />
    <CompanionEnrollmentSettings />
    <section className="staff-phones-section" aria-labelledby="staff-phones-heading">
      <div className="staff-devices-heading"><div><h3 id="staff-phones-heading">{ownerOnly?"Connected Phones":"Staff Phones"}</h3><p>Receive photo requests from {terminalName} on a paired staff phone.</p></div>{devices.length > 0 && <Button variant="primary" onClick={pair}><Link2 size={16}/>{ownerOnly?"Pair My Phone":"Pair Staff Phone"}</Button>}</div>
      {devices.length ? <div className="staff-phone-list">{devices.map(device => <article className="staff-phone-card" key={device.id}>
        <div className="staff-phone-card-heading"><span className="bridge-device-icon"><Smartphone size={23}/></span><div><strong>{device.deviceName || "Staff Phone"}</strong><span>{device.platform || "Android"} · {device.terminalName || terminalName}</span></div><span className={`staff-device-presence ${device.online ? "online" : "offline"}`}>{device.online ? "Online" : "Offline"}</span></div>
        <p className="staff-phone-last-seen">Last seen: {lastSeen(device)}</p>
        <div className="staff-phone-actions">
          <Button size="small" disabled={busy || auth !== "signed-in"} onClick={() => void run(async () => { const current = await deviceBridgeService.devices(terminalId); const phone = current.find(item => item.id === device.id); setMessage(phone?.online ? `${device.deviceName} is online.` : `${device.deviceName} is offline. Open Taha Staff on the phone and try again.`); }, "")}><RefreshCw size={14}/>Test Connection</Button>
          <Button size="small" variant="primary" disabled={busy || !device.online || auth !== "signed-in"} onClick={() => void run(async () => { const job = await deviceBridgeService.test(device.id); setTestId(job.id); useCameraStore.getState().receive(job); }, `Test request sent to ${device.deviceName}.`)}><Send size={14}/>Send Test Request</Button>
          <Button size="small" disabled={busy} onClick={() => { setRename(device); setName(device.deviceName); setError(""); }}><Pencil size={14}/>Rename</Button>
          <Button size="small" variant="ghost" disabled={busy} onClick={() => setDisconnect(device)}><Unplug size={14}/>Disconnect</Button>
        </div>
      </article>)}</div> : <div className="staff-phone-empty"><span className="bridge-device-icon"><Smartphone size={28}/></span><h4>{ownerOnly?"No phone paired":"No staff phone paired"}</h4><p>Pair an Android staff phone to capture photos for this counter.</p><Button variant="primary" onClick={pair}><Link2 size={16}/>{ownerOnly?"Pair My Phone":"Pair Staff Phone"}</Button></div>}
      {auth === "loading" && <p className="bridge-loading" role="status">Checking your shop connection…</p>}
      {message && <p className="bridge-inline-success" role="status">{testJob?.status==="received"?"Device communication working ✓":message}</p>}
      {error && !rename && <p role="alert" className="bridge-inline-error">{error}</p>}
      <div className="staff-devices-footer"><Button variant="ghost" size="small" disabled={busy || auth !== "signed-in"} onClick={() => void run(refresh, "Staff phone connections refreshed.")}><RefreshCw size={14}/>Refresh Devices</Button><Button variant="ghost" size="small" disabled={busy || !devices.length || auth !== "signed-in"} onClick={() => setReset(true)}>Reset Pairing</Button></div>
    </section>
    <section className="staff-customer-display-section"><span className="bridge-device-icon"><Monitor size={22}/></span><div><h3>Customer Display</h3><p>Manage display preferences and the screen shown to your customers.</p></div><Link className="button button-secondary button-small" to="/settings?section=Customer%20Display">Manage Customer Display</Link></section>
    <Dialog open={!!rename} onOpenChange={open => { if (!open && !busy) setRename(null); }} title="Rename Staff Phone" description="Choose a name your staff can recognize." className="staff-phone-rename-dialog">
      <form className="bridge-sign-in-form" onSubmit={event => { event.preventDefault(); if (!rename || !name.trim()) return; void run(async () => { await deviceBridgeService.rename(rename.id, name.trim()); await refresh(); setRename(null); }, "Phone name updated."); }}>
        <label htmlFor="staff-phone-name">Phone name</label><input className="input" id="staff-phone-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required disabled={busy}/>
        {error && <p role="alert" className="bridge-inline-error">{error}</p>}
        <div className="dialog-actions"><Button disabled={busy} onClick={() => setRename(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save Name"}</Button></div>
      </form>
    </Dialog>
    <ConfirmDialog open={!!disconnect} title="Disconnect Staff Phone?" description={`Disconnect ${disconnect?.deviceName || "this staff phone"} from ${terminalName}? Pending requests for this phone will be cancelled. Completed photos stay with their records.`} confirm="Disconnect" busy={busy} onClose={() => setDisconnect(null)} onConfirm={() => { if (!disconnect) return; void run(async () => { await deviceBridgeService.disconnect(disconnect.id); await refresh(); setDisconnect(null); }, "Staff phone disconnected."); }}/>
    <ConfirmDialog open={reset} title="Reset Staff Phone Pairing?" description="Disconnect all staff phones paired with this counter and cancel their pending requests. This only resets phone pairing; products, stock, customers and sales stay unchanged." confirm="Reset Pairing" busy={busy} onClose={() => setReset(false)} onConfirm={() => void run(async () => { await deviceBridgeService.resetPairing(); setReset(false); }, "Staff phone pairing reset.")}/>
  </div>;
}
