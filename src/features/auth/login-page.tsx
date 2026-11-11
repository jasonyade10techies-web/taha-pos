import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, LogOut, Monitor } from "lucide-react";
import { Logo } from "../../components/ui/logo";
import { Button } from "../../components/ui/button";
import {
  mockAuthEnabled,
  googleEnabled,
  backendConfigured,
  configurationMessage,
} from "../../lib/config";
import { friendlyError } from "../../lib/errors";
import { useSessionStore } from "../../stores/session-store";
import { authService } from "./services/auth-service";
import { mockSignIn, signOut } from "./session-actions";
import { canOpenRoute, homeRoute } from "./route-access";
import {bundledMobile} from "../../lib/mobile/runtime";

export function LoginPage() {
  const { authStatus, authError, profile, permissions } = useSessionStore();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const from =
    (location.state as { from?: string } | null)?.from ?? (bundledMobile?"/mobile-camera":"/dashboard");
  if (authStatus === "authenticated")
    return (
      <Navigate
        replace
        to={
          canOpenRoute(from, profile, permissions)
            ? from
            : homeRoute(profile, permissions)
        }
      />
    );
  if (authStatus === "counter-locked")
    return <Navigate to="/counter" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authService.signIn(email.trim(), password);
      setPassword("");
    } catch (cause) {
      setError(
        friendlyError(
          cause,
          "Unable to sign in. Check your details and connection.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setBusy(true);
    setError("");
    try {
      await authService.signInWithGoogle();
    } catch (cause) {
      setError(
        friendlyError(
          cause,
          "Google sign-in could not start. Contact the owner.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-top">
        <Logo />
        <span className="text-xs text-muted">Internal workspace</span>
      </div>
      <section className="auth-card panel">
        <span className="auth-symbol">
          <ShieldCheck size={25} />
        </span>
        <h1>Welcome to your workspace</h1>
        <p className="auth-subtitle">
          Sign in to TAHA MOBILES. Your access is managed by the owner.
        </p>
        {authStatus === "loading" ? (
          <p role="status">Checking your session…</p>
        ) : authStatus === "denied" || authStatus === "error" ? (
          <>
            <div className="auth-notice" role="alert">
              {authError ??
                "Your account is not assigned to an active employee profile and branch. Ask the owner to provision your access."}
            </div>
            <Button
              onClick={() => {
                window.dispatchEvent(new Event("taha-session-refresh"));
              }}
            >
              Retry access check
            </Button>
            <Button
              onClick={() => {
                void signOut(queryClient).catch(() =>
                  setError("The session was cleared locally."),
                );
              }}
            >
              <LogOut size={16} />
              Sign Out
            </Button>
          </>
        ) : (
          <>
            <Button
              className="google-signin"
              disabled={
                busy || mockAuthEnabled || !backendConfigured || !googleEnabled
              }
              onClick={() => void google()}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M21.8 12.2c0-.7-.1-1.4-.2-2.2H12v4.1h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.4c2-1.8 2.9-4.4 2.9-7.6ZM12 22c2.7 0 5-.9 6.9-2.2l-3.4-2.6a6.3 6.3 0 0 1-9.4-3.3H2.6v2.7A10 10 0 0 0 12 22ZM6.1 13.9a6 6 0 0 1 0-3.8V7.4H2.6a10 10 0 0 0 0 9.2l3.5-2.7ZM12 6a5.5 5.5 0 0 1 3.9 1.5l2.9-2.9A9.5 9.5 0 0 0 12 2a10 10 0 0 0-9.4 5.4l3.5 2.7A6 6 0 0 1 12 6Z"
                />
              </svg>
              Continue with Google
            </Button>
            {!googleEnabled && !mockAuthEnabled && (
              <p className="auth-help">
                Google sign-in is awaiting provider configuration.
              </p>
            )}
            <div className="auth-divider">
              <span>or use your work email</span>
            </div>
            <form onSubmit={(event) => void submit(event)}>
              <label className="field-label" htmlFor="login-email">
                Email
              </label>
              <input
                className="input"
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="you@your-business.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy || mockAuthEnabled || !backendConfigured}
              />
              <label className="field-label mt-4" htmlFor="login-password">
                Password
              </label>
              <input
                className="input"
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy || mockAuthEnabled || !backendConfigured}
              />
              <Button
                className="auth-submit"
                variant="primary"
                type="submit"
                disabled={busy || mockAuthEnabled || !backendConfigured}
              >
                {busy ? "Signing in…" : "Sign In"}
                <ArrowRight size={18} />
              </Button>
            </form>
            {mockAuthEnabled ? (
              <div className="auth-notice">
                <strong>Development mock mode</strong>
                <p>
                  Preview the approved workspace as Ahmed Khan · Owner / Admin.
                </p>
                <Button className="mt-3" variant="primary" onClick={mockSignIn}>
                  Enter mock owner workspace
                </Button>
              </div>
            ) : (
              !backendConfigured && (
                <div className="auth-notice" role="status">
                  {configurationMessage}
                </div>
              )
            )}
          </>
        )}
        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <p className="auth-help">
          <Monitor size={14} />
          Shared counters use an owner-provisioned terminal account.
        </p>
      </section>
      <footer className="auth-footer">
        TAHA MOBILES · Secure internal access
      </footer>
    </main>
  );
}
