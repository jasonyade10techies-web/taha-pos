import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase/client";
import { useSessionStore } from "../../stores/session-store";

export function AuthCallbackPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    if (!supabase) {
      setReady(true);
      return;
    }
    // The SDK validates the PKCE verifier and consumes the URL code before routing removes it.
    void supabase.auth.initialize().then(({ error }) => {
      if (!active) return;
      if (error)
        useSessionStore
          .getState()
          .resetAuth(
            "error",
            "Google authorization could not be completed. Please sign in again.",
          );
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  return ready ? (
    <Navigate to="/login" replace />
  ) : (
    <p className="p-8 text-muted" role="status">
      Completing secure sign-in…
    </p>
  );
}
