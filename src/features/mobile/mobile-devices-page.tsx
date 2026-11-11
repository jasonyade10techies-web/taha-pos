import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Smartphone, ScanLine, Link2, Pencil, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { MobilePairing } from "../pos/mobile-pairing";
import { deviceBridgeService } from "../../lib/device-bridge/service";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import { useAction } from "../../hooks/use-repository";
import { apiRequest } from "../../lib/api/client";
import { requireMobileOnline } from "../../lib/mobile/staff-service";
import { cachedRead, cacheRead } from "../../lib/mobile/read-cache";
import type { StaffDevice } from "../../types/device-bridge";
import {useSessionStore} from '../../stores/session-store';
const sessionLabel = (s: { current: boolean; deviceName: string }) =>
  s.current
    ? "This Phone"
    : /Dalvik|Android/i.test(s.deviceName)
      ? "Android staff app"
      : /Mozilla.*Windows/i.test(s.deviceName)
        ? "Windows · Chrome"
        : /Mozilla.*Mac/i.test(s.deviceName)
          ? "Mac · Browser"
          : s.deviceName.slice(0, 80);
export function MobileDevicesPage() {
  const companion=useSessionStore(state=>!!state.context?.companion);
  const bridge = useDeviceBridgeStore(),
    action = useAction(),
    [code, setCode] = useState(""),
    [manual, setManual] = useState(false),
    [rename, setRename] = useState(false),
    [name, setName] = useState(bridge.deviceName),
    [disconnect, setDisconnect] = useState(false);
  const pair = useQuery({
    queryKey: ["staff-pair", bridge.deviceId],
    queryFn: async () => {
      try {
        requireMobileOnline();
        const devices = await deviceBridgeService.devices();
        const own = devices.find((d) => d.pairedToThisDevice) || null;
        await cacheRead("paired-counter", own);
        return own;
      } catch (c) {
        const saved = await cachedRead<StaffDevice | null>("paired-counter");
        if (saved !== undefined) return saved;
        throw c;
      }
    },
  });
  const sessions = useQuery({
    enabled:!companion,
    queryKey: ["staff-sessions"],
    queryFn: () =>
      apiRequest<
        {
          id: string;
          deviceName: string;
          lastActiveAt: string;
          current: boolean;
        }[]
      >("/auth/devices"),
  });
  const own = bridge.ownPair || pair.data;
  return (
    <div className="staff-page">
      <div className="staff-page-heading">
        <span className="eyebrow">YOUR CONNECTIONS</span>
        <h1>Devices</h1>
        <p>Counter pairing and account sessions.</p>
      </div>
      <section className="panel staff-device-panel">
        <span className="staff-row-icon">
          <Smartphone />
        </span>
        <h2>{own ? "Connected Counter" : "No Counter Paired"}</h2>
        {own ? (
          <>
            <h3>{own.terminalName}</h3>
            <p>TAHA MOBILES · Main Branch</p>
            <span
              className={`staff-network ${bridge.connected ? "online" : "offline"}`}
            >
              <i />
              {bridge.connected ? "Online" : "Offline · Pairing remembered"}
            </span>
            <div className="staff-button-stack">
              <Button
                onClick={() =>
                  void action.run(
                    () => deviceBridgeService.heartbeat(true),
                    "Connection working",
                  )
                }
              >
                Test Connection
              </Button>
              <Button
                onClick={() =>
                  window.dispatchEvent(new Event("taha-scan-open"))
                }
              >
                <ScanLine size={18} />
                Change Counter
              </Button>
              <Button variant="ghost" onClick={() => companion?window.dispatchEvent(new Event('taha-mobile-logout')):setDisconnect(true)}>
                {companion?'Disconnect and Sign Out':'Disconnect'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>
              Pair your phone to receive photo requests from a Taha POS counter.
            </p>
            <div className="staff-button-stack">
              <Button
                variant="primary"
                onClick={() =>
                  window.dispatchEvent(new Event("taha-scan-open"))
                }
              >
                <ScanLine size={18} />
                Scan Pairing QR
              </Button>
              <Button onClick={() => setManual(true)}>
                <Link2 size={18} />
                Enter Pairing Code
              </Button>
            </div>
          </>
        )}
      </section>
      <section className="staff-section">
        <div className="staff-section-heading">
          <h2>This phone</h2>
          <Button
            variant="ghost"
            aria-label="Rename phone"
            disabled={companion}
            onClick={() => setRename(true)}
          >
            <Pencil size={18} />
          </Button>
        </div>
        <article className="panel staff-list-row">
          <Smartphone />
          <div>
            <strong>{bridge.deviceName}</strong>
            <small>Your staff camera device</small>
          </div>
        </article>
      </section>
      {!companion&&<section className="staff-section">
        <h2>Account sessions</h2>
        {sessions.data?.map((s) => (
          <article className="panel staff-list-row" key={s.id}>
            <Smartphone />
            <div>
              <strong>{sessionLabel(s)}</strong>
              <small>
                {s.current
                  ? "Current device"
                  : `Last active ${new Date(s.lastActiveAt).toLocaleDateString()}`}
              </small>
            </div>
            {!s.current && (
              <Button
                variant="ghost"
                aria-label={`Sign out ${sessionLabel(s)}`}
                onClick={() =>
                  void action.run(
                    () =>
                      apiRequest("/auth/devices/" + s.id, { method: "DELETE" }),
                    "Device signed out",
                  )
                }
              >
                <LogOut size={18} />
              </Button>
            )}
          </article>
        ))}
      </section>}
      {companion&&<p className="auth-notice">This is a camera companion session. Manage its name and revoke access from the counter. Signing out ends this phone’s access; save unsent photos before confirming sign-out.</p>}
      {action.error && (
        <p role="alert" className="text-danger">
          {action.error}
        </p>
      )}
      <Dialog
        open={manual}
        onOpenChange={setManual}
        title="Enter Pairing Code"
        className="bottom-sheet"
      >
        <label className="form-field">
          6-digit code
          <input
            className="input pairing-code-input"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        {code.length === 6 && (
          <MobilePairing
            code={code}
            automatic
            onPaired={() => setManual(false)}
          />
        )}
      </Dialog>
      <Dialog
        open={rename}
        onOpenChange={setRename}
        title="Rename Phone"
        className="bottom-sheet"
      >
        <label className="form-field">
          Device name
          <input
            className="input"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button
          variant="primary"
          disabled={!name.trim() || action.busy}
          onClick={() =>
            void action.run(async () => {
              requireMobileOnline();
              if (own) await deviceBridgeService.rename(own.id, name);
              useDeviceBridgeStore.setState({ deviceName: name });
              setRename(false);
            }, "Phone renamed")
          }
        >
          Save
        </Button>
      </Dialog>
      <Dialog
        open={disconnect}
        onOpenChange={setDisconnect}
        title="Disconnect this counter?"
        description="Your account and shop data will be kept."
        className="bottom-sheet"
      >
        <Button
          variant="danger"
          onClick={() =>
            void action.run(async () => {
              requireMobileOnline();
              if (own) await deviceBridgeService.disconnect(own.id);
              await cacheRead("paired-counter", null);
              await pair.refetch();
              setDisconnect(false);
            }, "Counter disconnected")
          }
        >
          Disconnect
        </Button>
      </Dialog>
    </div>
  );
}
