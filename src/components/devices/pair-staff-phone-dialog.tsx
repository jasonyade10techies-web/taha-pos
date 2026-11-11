import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Clock3, RefreshCw, Smartphone } from "lucide-react";
import { deviceBridgeService } from "../../lib/device-bridge/service";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import type { PairingCode, StaffDevice } from "../../types/device-bridge";
import { BridgeSignInDialog } from "./bridge-sign-in";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

export type PairStaffPhoneDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

function PairingContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const terminalId = useDeviceBridgeStore(state => state.terminalId);
  const devices = useDeviceBridgeStore(state => state.devices);
  const context = useDeviceBridgeStore(state => state.context);
  const terminalName = useDeviceBridgeStore(state => state.terminalName);
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const initialIds = useRef<Set<string> | null>(null);
  const active = useRef(true);
  const generation = useRef(0);
  const close = useRef(onOpenChange);
  useEffect(() => { close.current = onOpenChange; }, [onOpenChange]);
  useEffect(() => {
    active.current = true;
    const attempt = ++generation.current;
    async function createCode() {
      try {
        const existing = await deviceBridgeService.devices(terminalId);
        if (!active.current || generation.current !== attempt) return;
        initialIds.current = new Set(existing.map(device => device.id));
        const code = await deviceBridgeService.pairing();
        if (active.current && generation.current === attempt) setPairing(code);
      } catch {
        if (active.current && generation.current === attempt) setError("Could not create a pairing code. Check your shop connection and try again.");
      } finally {
        if (active.current && generation.current === attempt) setBusy(false);
      }
    }
    void createCode();
    return () => { active.current = false; };
  }, [terminalId]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const paired: StaffDevice | undefined = pairing && initialIds.current
    ? devices.find(device => device.terminalId === terminalId && !initialIds.current!.has(device.id))
    : undefined;
  const pairedId = paired?.id;
  useEffect(() => {
    if (!pairedId) return;
    const timer = window.setTimeout(() => close.current(false), 1100);
    return () => window.clearTimeout(timer);
  }, [pairedId]);
  async function refreshCode() {
    if (busy) return;
    setBusy(true);
    setError("");
    const attempt = ++generation.current;
    try {
      if (!initialIds.current) {
        const existing = await deviceBridgeService.devices(terminalId);
        if (!active.current || generation.current !== attempt) return;
        initialIds.current = new Set(existing.map(device => device.id));
      }
      const code = await deviceBridgeService.pairing();
      if (active.current && generation.current === attempt) { setPairing(code); setNow(Date.now()); }
    } catch {
      if (active.current && generation.current === attempt) setError("Could not refresh the code. Check your shop connection and try again.");
    } finally {
      if (active.current && generation.current === attempt) setBusy(false);
    }
  }
  const remaining = pairing ? Math.max(0, Math.ceil((new Date(pairing.expiresAt).getTime() - now) / 1000)) : 0;
  const code = pairing?.code.replace(/\D/g, "") ?? "";
  if (paired) return <div className="staff-phone-paired" role="status"><CheckCircle2 size={56}/><h3>Phone Connected</h3><strong>{paired.deviceName}</strong><p>This phone is ready to receive photo requests from {terminalName}.</p></div>;
  return <>
    <div className="staff-pairing-card">
      <div className="staff-pairing-shop"><Smartphone size={20}/><div><strong>{pairing?.shopName || context?.store?.name || "Your Shop"}</strong><span>{pairing?.branchName || context?.store?.branch_name} · {pairing?.terminalName || terminalName}</span></div></div>
      <div className="staff-pairing-qr">
        {pairing && remaining > 0 && !busy ? <QRCodeSVG value={pairing.qrPayload} size={280} fgColor="#000000" bgColor="#ffffff" marginSize={4} title="Staff phone pairing QR code" role="img" aria-label="Staff phone pairing QR code"/> : <div className="staff-pairing-placeholder" role="status">{busy ? <><RefreshCw className="bridge-spinner" size={28}/><span>Creating pairing code…</span></> : <><Clock3 size={28}/><span>{pairing ? "Pairing code expired" : "Pairing code unavailable"}</span></>}</div>}
      </div>
      <span className="staff-pairing-code-label">SIX-DIGIT PAIRING CODE</span>
      <strong className="staff-pairing-code">{code ? `${code.slice(0, 3)} ${code.slice(3)}` : "— — —"}</strong>
      <p className="staff-pairing-expiry"><Clock3 size={14}/>{pairing ? remaining > 0 ? `Expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "Code expired. Refresh to try again." : "Code expires after a few minutes."}</p>
    </div>
    <p className="staff-pairing-instructions">Open Taha Staff on the phone, tap <strong>Scan QR</strong>, then confirm pairing with this counter. You can also enter the six-digit code.</p>
    {error && <p role="alert" className="bridge-inline-error">{error}</p>}
    <div className="dialog-actions"><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={busy} onClick={() => void refreshCode()}><RefreshCw size={16}/>{busy ? "Creating Code…" : "Refresh Code"}</Button></div>
  </>;
}

export function PairStaffPhoneDialog({ open, onOpenChange }: PairStaffPhoneDialogProps) {
  const auth = useDeviceBridgeStore(state => state.auth);
  if (auth === "signed-out") return <BridgeSignInDialog open={open} onOpenChange={next => {
    if (next || useDeviceBridgeStore.getState().auth !== "signed-in") onOpenChange(next);
  }}/>;
  return <Dialog open={open} onOpenChange={onOpenChange} title="Pair Staff Phone" description="Connect a staff phone to receive this counter’s photo requests." className="staff-pairing-dialog">
    {open && (auth === "loading" ? <p role="status" className="bridge-loading">Connecting to your shop…</p> : <PairingContent onOpenChange={onOpenChange}/>)}
  </Dialog>;
}

