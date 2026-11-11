import { useState } from "react";
import { Maximize2, Monitor, RefreshCw, Link2 } from "lucide-react";
import { useDisplayStore } from "../../stores/display-store";
import { useUiStore } from "../../stores/ui-store";
import { localPairingCode, reconnectDisplay } from "../../hooks/use-customer-display";
import { Dropdown, DropdownItem, DropdownSeparator } from "../ui/dropdown";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { apiEnabled } from "../../lib/config";
import { remoteDisplay } from "../../lib/api/customer-display";
import {DisplayConnectionsDialog} from "./display-connections-dialog";
import {nativeDesktop} from '../../lib/desktop/runtime';
import {invoke} from '@tauri-apps/api/core';

export function CustomerDisplayControl() {
  const connected = useDisplayStore((s) => s.connected);
  const terminalId = useUiStore((s) => s.terminalId);
  const [waiting, setWaiting] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manageOpen,setManageOpen]=useState(false);
  const fullscreenPreference = useUiStore(s => s.customerDisplayFullscreen);
  const open = (fullscreen = fullscreenPreference) => {
    if(nativeDesktop){void invoke('desktop_display',{terminal:terminalId,fullscreen}).then(()=>{setWaiting(true);reconnectDisplay();}).catch(()=>setError('The customer display could not be opened. Retry from this counter.'));return;}
    const base = window.location.hash.startsWith("#/") ? "/#/customer-display" : "/customer-display";
    const display = window.open(`${base}?terminal=${encodeURIComponent(terminalId)}${fullscreen ? "&fullscreen=true" : ""}`, `taha-display-${terminalId}`, "popup,width=1366,height=768");
    setWaiting(!!display);
    if (!display) setError("Your browser blocked the display window. Allow pop-ups for Taha POS, then try again.");
  };
  return <><Dropdown label="Customer display controls" trigger={<button className={`display-control ${connected ? "connected" : waiting ? "waiting" : "disconnected"}`} aria-label="Customer Display controls"><Monitor size={16} /><span>Customer Display</span><i /><small>{connected ? "Connected" : waiting ? "Waiting" : "Disconnected"}</small></button>}><div className="dropdown-label">Customer-facing screen</div><DropdownItem onSelect={() => open()}><Monitor size={16} />Open Customer Display</DropdownItem><DropdownItem onSelect={() => { reconnectDisplay(); open(); }}><RefreshCw size={16} />Reconnect</DropdownItem><DropdownItem onSelect={() => open(true)}><Maximize2 size={16} />Fullscreen Customer Display</DropdownItem><DropdownSeparator /><DropdownItem onSelect={() => setPairOpen(true)}><Link2 size={16} />Connect Display</DropdownItem>{apiEnabled && <DropdownItem onSelect={()=>setManageOpen(true)}><Monitor size={16}/>Manage Displays</DropdownItem>}</Dropdown><Dialog open={pairOpen} onOpenChange={setPairOpen} title="Connect Customer Display" description={apiEnabled ? "Open /customer-display on the other screen, then enter its eight-character code here. Each display pairs with this counter only." : "A display opened from this counter pairs automatically. Confirm its local code below."}>{!apiEnabled && <div className="pairing-code"><span>Main Counter pairing code</span><strong>{localPairingCode(terminalId).slice(0, 3)} {localPairingCode(terminalId).slice(3)}</strong></div>}<label className="form-field">Display pairing code<input className="input" inputMode={apiEnabled ? "text" : "numeric"} maxLength={apiEnabled ? 8 : 6} value={code} onChange={(e) => setCode(apiEnabled ? e.target.value.replace(/[^a-f0-9]/gi, "").toUpperCase() : e.target.value.replace(/\D/g, ""))} /></label><p className="text-sm text-muted mt-3">{apiEnabled ? "The display receives only this counter’s order and payment instructions. No staff account is required on that screen." : "Displays opened from this counter pair automatically."}</p>{error && <p role="alert" className="text-danger">{error}</p>}<div className="dialog-actions"><Button onClick={() => setPairOpen(false)}>Cancel</Button><Button variant="primary" disabled={code.length !== (apiEnabled ? 8 : 6) || busy} onClick={() => {
      setError("");
      if (apiEnabled) { setBusy(true); void remoteDisplay.pair(code,terminalId).then(() => {setPairOpen(false);reconnectDisplay();}).catch(cause=>setError(cause.message)).finally(()=>setBusy(false)); return; }
      if (code !== localPairingCode(terminalId)) return setError("This code does not belong to this counter."); setPairOpen(false); reconnectDisplay(); open();
    }}>{busy ? "Connecting…" : "Connect Display"}</Button></div></Dialog>{apiEnabled && <DisplayConnectionsDialog open={manageOpen} onOpenChange={setManageOpen}/>}</>;
}
