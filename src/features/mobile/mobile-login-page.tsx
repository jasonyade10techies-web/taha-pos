import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Logo } from "../../components/ui/logo";
import { Button } from "../../components/ui/button";
import { apiAuth } from "../../lib/api/client";
import { useSessionStore } from "../../stores/session-store";
import { useMobilePreferences } from "../../stores/mobile-preferences-store";
import { useShopConnectionStore } from "../../stores/shop-connection-store";
import { bundledMobile } from "../../lib/mobile/runtime";
import { cacheSession } from "../../lib/mobile/read-cache";
export function MobileLoginPage() {
  const status = useSessionStore((s) => s.authStatus),
    location = useLocation(),
    connection = useShopConnectionStore();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const from = (location.state as { from?: string } | null)?.from;
  if (status === "authenticated")
    return (
      <Navigate
        to={
          from?.startsWith("/mobile") || from === "/profile" ? from : "/mobile"
        }
        replace
      />
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const context = await apiAuth.login(email.trim(), password);
      useSessionStore.getState().applyContext(context);
      useMobilePreferences.setState({ verifiedSession: true });
      await cacheSession(context);
      setPassword("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not sign in. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="staff-login">
      <Logo />
      <section className="panel">
        <span className="auth-symbol">
          <ShieldCheck size={24} />
        </span>
        <h1>Welcome to Taha Staff</h1>
        <p>Sign in to your shop workspace.</p>
        {bundledMobile&&<><Button variant="primary" onClick={()=>window.dispatchEvent(new Event('taha-scan-open'))}>Scan to Connect</Button><p className="text-muted">On the PC open Settings → Devices → Connect Phone. The owner approves this phone; no password is entered here.</p></>}
        <form onSubmit={(e) => void submit(e)}>
          <label className="form-field">
            Email
            <input
              className="input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="form-field">
            Password
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
            <ArrowRight size={18} />
          </Button>
        </form>
      </section>
      {bundledMobile && (
        <div className="staff-login-connection">
          <span
            className={`staff-network ${connection.connectionStatus === "connected" ? "online" : "offline"}`}
          >
            <i />
            {connection.connectionStatus === "connected"
              ? "Connected to Shop"
              : "Shop not reachable"}
          </span>
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                window.location.hash = "/shop-connection";
              }}
            >
              Shop Connection
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                window.location.hash = "/diagnostics";
              }}
            >
              Diagnostics
            </Button>
          </div>
        </div>
      )}
      <p className="text-muted">TAHA MOBILES · Internal staff application</p>
    </main>
  );
}
