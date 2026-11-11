import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { nativeDesktop, desktopConfig } from "../../lib/desktop/runtime";
import { useSessionStore } from "../../stores/session-store";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/workspace";
export function LocalBridgeSettings() {
  const owner = useSessionStore((s) => s.profile?.role === "owner"),
    [address, setAddress] = useState(desktopConfig().bridge || ""),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  if (!nativeDesktop || !owner) return null;
  return (
    <>
      <h3 className="mt-6">Local Staff Phone Connection</h3>
      <p className="text-muted">
        Keep the existing shop device server running on this PC. The installed
        counter connects directly; no browser counter page is required. Leave
        blank to use the cloud connection.
      </p>
      <label className="form-field">
        Local bridge address
        <input
          className="input"
          type="url"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Private LAN server address"
        />
      </label>
      <Button onClick={() => setConfirm(true)}>Change Local Bridge</Button>
      {error && (
        <p className="text-danger" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Change local phone connection?"
        description="Confirm the trusted shop LAN server. Device authentication stays separate from the cloud account."
        confirm="Change Local Bridge"
        onConfirm={() =>
          void invoke("desktop_bridge_config", { address, confirmed: true })
            .then(() => location.reload())
            .catch((cause) => {
              setError(String(cause));
              setConfirm(false);
            })
        }
      />
    </>
  );
}
