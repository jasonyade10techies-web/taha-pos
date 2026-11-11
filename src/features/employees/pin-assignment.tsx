import { useState } from "react";
import { usePermission } from "../../hooks/use-permission";
import { useSessionStore } from "../../stores/session-store";
import { counterService } from "../auth/services/counter-service";
import { Button } from "../../components/ui/button";
import { friendlyError } from "../../lib/errors";
export function PinAssignment({ profileId }: { profileId: string }) {
  const allow = usePermission("employees.manage");
  const { terminal, context } = useSessionStore();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!allow || terminal) return null;
  return (
    <form
      className="auth-notice mt-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!context?.store || pin.length !== 6 || busy) return;
        setBusy(true);
        setMessage("");
        try {
          await counterService.setPin(profileId, context.store.id, pin);
          setMessage(
            "PIN assigned securely. Existing counter sessions for this employee were revoked.",
          );
        } catch (error) {
          setMessage(
            friendlyError(
              error,
              "PIN could not be assigned. Check management permission and the active employee.",
            ),
          );
        } finally {
          setPin("");
          setBusy(false);
        }
      }}
    >
      <label className="form-field">
        Assign six-digit counter PIN
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <p className="text-xs text-muted">
        The server hashes the PIN. Stored PINs are never displayed.
      </p>
      <Button
        className="mt-3"
        type="submit"
        disabled={busy || pin.length !== 6}
      >
        Assign PIN
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
