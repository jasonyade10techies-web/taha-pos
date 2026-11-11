import {useShopConfiguration} from "../../hooks/use-shop-configuration";
import { useState } from "react";
import { ChevronDown, Send, Settings2, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import { useCameraStore } from "../../stores/camera-store";
import { deviceBridgeService } from "../../lib/device-bridge/service";
import { Button } from "../ui/button";
import { Dropdown, DropdownItem, DropdownSeparator } from "../ui/dropdown";

export function StaffPhoneStatus() {
  const {ownerOnly}=useShopConfiguration();
  const allDevices = useDeviceBridgeStore(state => state.devices);
  const terminalId = useDeviceBridgeStore(state => state.terminalId);
  const terminalName = useDeviceBridgeStore(state => state.terminalName);
  const devices = allDevices.filter(device => device.terminalId === terminalId);
  const online = devices.filter(device => device.online);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function sendTest(id: string, name: string) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const job = await deviceBridgeService.test(id);
      useCameraStore.getState().receive(job);
      setMessage(`Test request sent to ${name}.`);
    } catch { setError("Could not send the test request. Check the phone connection and try again."); }
    finally { setBusy(false); }
  }
  return <Dropdown label={ownerOnly?"My phone status":"Staff phone status"} trigger={<Button variant="ghost" className={`staff-phone-status ${online.length ? "connected" : devices.length ? "offline" : "unpaired"}`} aria-label={`${ownerOnly?"My phone":"Staff phone"}: ${online.length ? "connected" : devices.length ? "offline" : "no phone paired"}`}>
    <Smartphone size={17}/><span className="staff-phone-status-dot"/><span>{online.length ? "Phone Connected" : devices.length ? "Phone Offline" : "No Phone Paired"}</span><ChevronDown size={13}/>
  </Button>}>
    <div className="staff-phone-popover-heading">{ownerOnly?"Connected Phones":"Staff Phones"}</div>
    {devices.length ? devices.map(device => <div className="staff-phone-popover-device" key={device.id}>
      <div><strong>{device.deviceName}</strong><span className={`staff-device-presence ${device.online ? "online" : "offline"}`}>{device.online ? "Online" : "Offline"}</span></div><small>{device.terminalName || terminalName}</small>
      <DropdownItem disabled={busy || !device.online} onSelect={() => void sendTest(device.id, device.deviceName)}><Send size={14}/>Send Test Request</DropdownItem>
    </div>) : <p className="staff-phone-popover-empty">{ownerOnly?"No phone paired with this counter.":"No staff phone paired with this counter."}</p>}
    {message && <p className="staff-phone-popover-message" role="status">{message}</p>}
    {error && <p className="staff-phone-popover-message bridge-inline-error" role="alert">{error}</p>}
    <DropdownSeparator/>
    {!devices.length && <DropdownItem onSelect={() => window.dispatchEvent(new Event("taha-pair-phone"))}><Smartphone size={15}/>{ownerOnly?"Pair My Phone":"Pair Staff Phone"}</DropdownItem>}
    <DropdownItem onSelect={() => navigate("/settings?section=Devices")}><Settings2 size={15}/>Manage Devices</DropdownItem>
  </Dropdown>;
}
