import { useState, type FormEvent } from "react";
import { LockKeyhole, Store } from "lucide-react";
import { signInBridge } from "../../lib/device-bridge/client";
import { ApiError } from "../../lib/api/client";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

export type BridgeSignInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
};

function ShopSignInForm({ onConnected }: { onConnected: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signInBridge(email.trim(), password);
      setPassword("");
      onConnected();
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401
        ? "Email or password was not accepted. Please try again."
        : cause instanceof ApiError && cause.status === 403
          ? "This account cannot connect staff devices. Ask your shop owner for access."
          : "Could not connect to your shop. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return <form className="bridge-sign-in-form" onSubmit={event => void submit(event)}>
    <div className="bridge-sign-in-intro"><span className="bridge-device-icon"><Store size={24}/></span><p>Use your shop account to connect staff phones to this counter.</p></div>
    <label htmlFor="bridge-shop-email">Email</label>
    <input id="bridge-shop-email" className="input" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy}/>
    <label htmlFor="bridge-shop-password">Password</label>
    <input id="bridge-shop-password" className="input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy}/>
    {error && <p className="bridge-inline-error" role="alert">{error}</p>}
    <Button type="submit" variant="primary" disabled={busy}><LockKeyhole size={17}/>{busy ? "Signing In…" : "Sign In"}</Button>
  </form>;
}

export function BridgeSignInDialog({ open, onOpenChange, onConnected }: BridgeSignInDialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange} title="Sign In to Your Shop" description="Connect this counter to your shop." className="bridge-sign-in-dialog">
    {open && <ShopSignInForm onConnected={() => { onConnected?.(); onOpenChange(false); }}/>} 
  </Dialog>;
}
