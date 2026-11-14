import {useCartStore} from "../../stores/cart-store";
import {AppUpdatesPage} from "./app-updates-page";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { Logo } from "../../components/ui/logo";
import { Button } from "../../components/ui/button";
import { useShopConnectionStore } from "../../stores/shop-connection-store";
import { useSessionStore } from "../../stores/session-store";
import { parseShopAddress } from "../../lib/mobile/address";
import {
  bundledMobile,
  mobileTestBuild,
  mobileVersion,
  nativeInfo,
} from "../../lib/mobile/runtime";
import { QrScanner } from "../../components/camera/qr-scanner";
import { cameraService, cameraError } from "../../lib/camera-service";
import { MobileCaptureCard } from "../pos/mobile-capture-card";
import { useCameraStore } from "../../stores/camera-store";
import { useBridgeDiagnostics } from "../../hooks/use-bridge-diagnostics";
import {CompanionEnrollment} from './companion-enrollment';
import {NearbyCounters} from './nearby-counters';
const labels = {
  unconfigured: "Not configured",
  connecting: "Connecting",
  connected: "Connected",
  "shop-not-reachable": "Shop not reachable",
  "invalid-address": "Invalid address",
  "network-blocked": "Network blocked",
  "server-error": "Server error",
  "authentication-required": "Authentication required",
  timeout: "Timeout",
};
let pendingPair: { address: string; target: string } | null = null;
export function ConnectionPage() {
  const connection = useShopConnectionStore();
  const [address, setAddress] = useState(connection.baseUrl);
  const [tested, setTested] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  if (showDiagnostics)
    return <DiagnosticsPage onBack={() => setShowDiagnostics(false)} />;
  return (
    <main className="shop-connect-page">
      <Logo />
      <section className="panel shop-connect-card">
        <span className="eyebrow">
          STAFF APP · {mobileTestBuild ? "TEST" : "SECURE CONNECTION"}
        </span>
        <h1>Connect to Shop</h1>
        {bundledMobile && <a href="#/mobile/updates">App Updates</a>}
        <NearbyCounters/>
        <p>
          The app runs on your phone. This address connects it to the Taha shop
          backend.
        </p>
        <label className="form-field">
          Shop Address
          <input
            className="input"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="http://PC-IP:API-PORT"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setTested("");
            }}
          />
        </label>
        <p className="text-muted text-xs">
          Use the Shop Address shown on your counter, or scan its connection QR.
        </p>
        <div className="shop-connect-actions">
          <Button
            disabled={
              connection.connectionStatus === "connecting" || !address.trim()
            }
            onClick={() => {
              void connection
                .check(address)
                .then((ok) => setTested(ok ? address : ""));
            }}
          >
            {connection.connectionStatus === "connecting"
              ? "Connecting…"
              : "Test Connection"}
          </Button>
          <Button
            variant="primary"
            disabled={
              connection.connectionStatus === "connecting" ||
              tested !== address ||
              !tested
            }
            onClick={() => {
              void connection.connect(address).then((ok) => {
                if (ok) {
                  location.hash =
                    pendingPair &&
                    pendingPair.address ===
                      useShopConnectionStore.getState().baseUrl
                      ? pendingPair.target
                      : "/mobile";
                  pendingPair = null;
                }
              });
            }}
          >
            Connect
          </Button>
        </div>
        <div
          className={`shop-connection-result ${connection.healthPassed ? "success" : ""}`}
          role="status"
        >
          <strong>{labels[connection.connectionStatus]}</strong>
          {tested && connection.healthPassed ? (
            <p>
              {parseShopAddress(tested, mobileTestBuild).display} ·{" "}
              {connection.latency} ms · Database connected
            </p>
          ) : (
            connection.lastError && (
              <>
                <p>{connection.lastError}</p>
                <ul>
                  <li>Shop PC and API server must be running</li>
                  <li>Phone must be on the same network</li>
                  <li>Windows Firewall must allow the API port</li>
                </ul>
                <Button
                  size="small"
                  onClick={() =>
                    void connection
                      .check(address)
                      .then((ok) => setTested(ok ? address : ""))
                  }
                >
                  Retry
                </Button>
              </>
            )
          )}
        </div>
        {connection.accepted && (
          <dl className="shop-diagnostics">
            <div>
              <dt>Shop</dt>
              <dd>{connection.shopName || "Taha Mobiles"}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>Main Branch</dd>
            </div>
            <div>
              <dt>Server</dt>
              <dd>{new URL(connection.baseUrl).host}</dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>{connection.latency} ms</dd>
            </div>
          </dl>
        )}
        <Button
          onClick={() => window.dispatchEvent(new Event("taha-scan-open"))}
        >
          QR Scan to Connect
        </Button>
        <Button onClick={() => setShowDiagnostics(true)}>Diagnostics</Button>
        {connection.accepted && (
          <>
            <Button
              onClick={() => {
                location.hash = "/mobile";
              }}
            >
              Back to staff home
            </Button>
            <Button
              onClick={() => {
                connection.reset();
                window.TahaNative?.clearSession?.();
              }}
            >
              Disconnect
            </Button>
          </>
        )}
      </section>
      <p className="text-xs text-muted">
        TAHA MOBILES · App {mobileVersion} · UI bundled on this device
      </p>
    </main>
  );
}
export function DiagnosticsPage({ onBack }: { onBack?: () => void }) {
  const bridgeEntries = useBridgeDiagnostics();
  const [testId, setTestId] = useState<string | null>(null),
    [testError, setTestError] = useState("");
  const testJob = useCameraStore((s) => s.jobs.find((j) => j.id === testId));
  const state = useShopConnectionStore();
  const cartBusy=useCartStore(s=>s.items.length>0),checkoutBusy=useSessionStore(s=>s.checkoutOpen);
  useEffect(()=>{window.TahaNative?.setUpdateBusy?.(cartBusy||checkoutBusy);},[cartBusy,checkoutBusy]);
  const signedIn = useSessionStore((s) => s.authStatus === "authenticated");
  const info = nativeInfo();
  let host = "—",
    port = "—",
    protocol = "—";
  const testedAddress = state.attemptedUrl || state.baseUrl;
  try {
    const parsed = parseShopAddress(testedAddress, mobileTestBuild);
    host = parsed.host;
    port = parsed.port;
    protocol = parsed.protocol;
  } catch {
    /* The invalid address is shown without navigating. */
  }
  const entries: Record<string, string> = {
    "App Version": info.version || mobileVersion,
    "Build Number": info.buildNumber || "Browser preview",
    "Build Type": mobileTestBuild ? "TEST" : "PRODUCTION",
    "Shop Address": state.baseUrl || "Not configured",
    "Parsed Host": host,
    "Parsed Port": port,
    Protocol: protocol,
    Connection: labels[state.connectionStatus],
    "Last Tested Address": testedAddress || "Not configured",
    "Health Endpoint": testedAddress
      ? testedAddress + "/api/v1/health"
      : "Not configured",
    "Health Result": state.healthPassed ? "Pass" : "Not checked / Fail",
    Latency: state.latency === null ? "—" : `${state.latency} ms`,
    Authentication: signedIn ? "Signed In" : "Signed Out",
    "Camera Permission":
      info.cameraPermission || "Requested when camera or QR scanner opens",
    "Gallery Permission": "System picker; selected photos only",
    "Network Type": info.network || (!navigator.onLine ? "Offline" : "Unknown"),
    "Last Successful Connection": state.lastSuccessfulConnection || "Never",
    "Last Error": state.lastError || "None",
    "Last UI Error": window.__tahaLastUiError || "None",
  };
  const [copied, setCopied] = useState(false);
  return (
    <main className="shop-connect-page">
      <Logo />
      <section className="panel shop-connect-card">
        <h1>Diagnostics</h1>
        <p>
          Connection details only. Passwords, PINs and session tokens are
          excluded.
        </p>
        <dl className="shop-diagnostics">
          {Object.entries({ ...entries, ...bridgeEntries }).map(
            ([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ),
          )}
        </dl>
        <div className="shop-connect-actions">
          <Button onClick={() => void state.check()}>Retry Connection</Button>
          <Button
            onClick={() => {
              const text = Object.entries({ ...entries, ...bridgeEntries })
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n");
              void navigator.clipboard
                ?.writeText(text)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? "Copied" : "Copy Diagnostics"}
          </Button>
          <Button
            onClick={() =>
              onBack ? onBack() : (location.hash = "/shop-connection")
            }
          >
            Change Shop Address
          </Button>
          <Button
            disabled={!signedIn}
            onClick={() =>
              void cameraService
                .diagnostic()
                .then((job) => setTestId(job.id))
                .catch((c) => setTestError(cameraError(c)))
            }
          >
            Test Photo Upload
          </Button>
        </div>
        {testError && <p role="alert">{testError}</p>}
        {testJob && (
          <MobileCaptureCard job={testJob} onClose={() => setTestId(null)} />
        )}
      </section>
    </main>
  );
}
export function MobileRoot({ children }: { children: ReactNode }) {
  const state = useShopConnectionStore();
  const cartBusy=useCartStore(s=>s.items.length>0),checkoutBusy=useSessionStore(s=>s.checkoutOpen);
  useEffect(()=>{window.TahaNative?.setUpdateBusy?.(cartBusy||checkoutBusy);},[cartBusy,checkoutBusy]);
  const [route, setRoute] = useState(location.hash.slice(1).split("?")[0]);
  const savedAddress = useRef(state.baseUrl);
  useEffect(() => {
    if (!bundledMobile) return;
    const changed = () => setRoute(location.hash.slice(1).split("?")[0]);
    window.addEventListener("hashchange", changed);
    const probe = () => {
      const current = useShopConnectionStore.getState();
      if (document.visibilityState === "visible" && current.baseUrl)
        void current.check().then((ok) => {
          if (
            ok &&
            !useShopConnectionStore.getState().accepted &&
            current.baseUrl === savedAddress.current
          )
            void useShopConnectionStore.getState().connect(current.baseUrl);
        });
    };
    const paired = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          shopAddress: string;
          terminalId: string;
          code: string;
        }>
      ).detail;
      if (!detail) return;
      // A different origin always requires explicit Test Connection / Connect first.
      const target = `/mobile/activity?terminal=${encodeURIComponent(detail.terminalId)}&pair=${encodeURIComponent(detail.code)}`;
      if (detail.shopAddress === useShopConnectionStore.getState().baseUrl)
        location.hash = target;
      else {
        pendingPair = { address: detail.shopAddress, target };
        useShopConnectionStore.getState().reset();
        useShopConnectionStore.setState({ baseUrl: detail.shopAddress });
        location.hash = "/shop-connection";
      }
    };
    const lost = () => useShopConnectionStore.getState().markFailure();
    window.addEventListener("offline", lost);
    const configured=import.meta.env.VITE_MOBILE_SHOP_URL?.trim();
    if(!mobileTestBuild&&configured&&!useShopConnectionStore.getState().baseUrl){
      try{const address=parseShopAddress(configured,false).baseUrl;savedAddress.current=address;useShopConnectionStore.setState({baseUrl:address});void useShopConnectionStore.getState().connect(address);}
      catch{useShopConnectionStore.setState({connectionStatus:'invalid-address',lastError:'The configured shop address is invalid. Contact your administrator.'});}
    }
    probe();
    const timer = setInterval(probe, 20000);
    window.addEventListener("online", probe);
    window.addEventListener("taha-app-resume", probe);
    document.addEventListener("visibilitychange", probe);
    window.addEventListener("taha-pair-link", paired);
    return () => {
      window.removeEventListener("offline", lost);
      clearInterval(timer);
      window.removeEventListener("hashchange", changed);
      window.removeEventListener("online", probe);
      window.removeEventListener("taha-app-resume", probe);
      document.removeEventListener("visibilitychange", probe);
      window.removeEventListener("taha-pair-link", paired);
    };
  }, []);
  const content = !bundledMobile ? (
    children
  ) : route === "/mobile/updates" ? (
    <AppUpdatesPage />
  ) : route === "/diagnostics" ? (
    <DiagnosticsPage />
  ) : (!state.accepted && !state.baseUrl) || route === "/shop-connection" ? (
    <ConnectionPage key={state.baseUrl} />
  ) : (
    children
  );
  return (
    <>
      <QrScanner />
      <CompanionEnrollment />
      {content}
    </>
  );
}
