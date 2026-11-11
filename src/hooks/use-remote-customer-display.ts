import { useEffect, useState } from "react";
import { remoteDisplay, type DisplayRegistration } from "../lib/api/customer-display";
import type { CustomerDisplayState } from "../types/phase4b";

const idle: CustomerDisplayState = { mode: "IDLE", terminalId: "", items: [], subtotal: 0, discount: 0, total: 0 };
let registrationPromise:Promise<DisplayRegistration>|undefined;
const register=()=>registrationPromise ??= remoteDisplay.register().catch(cause=>{registrationPromise=undefined;throw cause;});
export function useRemoteCustomerDisplay(enabled: boolean, targetTerminal?: string | null) {
  const [state, setState] = useState(idle);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("Connecting");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false, registration: DisplayRegistration | undefined, inFlight = false;
    let lastContact = Date.now();
    const channel = targetTerminal && "BroadcastChannel" in window ? new BroadcastChannel("taha-pos-display-pairing") : null;
    const refresh = async () => {
      if (inFlight || disposed) return;
      inFlight = true;
      try {
        if (!registration) {
          registration = await register();
          if (disposed) return;
          setCode(registration.pairingCode);
          channel?.postMessage({ pairingCode: registration.pairingCode, terminalId: targetTerminal });
        }
        const connection = await remoteDisplay.read(registration);
        if (disposed) return;
        lastContact = Date.now(); setError("");
        setStatus(connection.status === "paired" ? "Connected" : "Waiting for counter");
        if (connection.snapshot) setState(connection.snapshot);
        else setState(idle);
      } catch (cause) {
        if (!disposed) { setStatus("Disconnected"); setError(cause instanceof Error ? cause.message : "Cannot reach the counter."); if ((cause as {status?:number})?.status===401 || Date.now() - lastContact >= 10000) setState(idle); }
      } finally { inFlight = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => { disposed = true; clearInterval(timer); channel?.close(); registration = undefined; };
  }, [enabled, targetTerminal, retry]);
  return { state, code, status, error, retry: () => { registrationPromise=undefined;setState(idle); setCode(""); setError(""); setRetry(v => v + 1); } };
}
