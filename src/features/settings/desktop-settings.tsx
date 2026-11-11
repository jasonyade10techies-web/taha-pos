import {Field} from '../../components/ui/workspace';
import {localDemoEnabled} from '../../lib/config';
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import { nativeDesktop, desktopConfig } from "../../lib/desktop/runtime";
import { useSessionStore } from "../../stores/session-store";
import { useSyncStore } from "../../stores/sync-store";
import { CashExceptions } from './cash-exceptions';
import { Button } from "../../components/ui/button";
import { AppSelect } from "../../components/ui/app-select";
import { ConfirmDialog } from "../../components/ui/workspace";
export function SynchronizationSettings() {
  const state = useSyncStore();
  return (
    <>
      <p className="text-muted">
        {nativeDesktop
          ? "Cash sales and receipts are saved in the local Windows database before synchronization."
          : localDemoEnabled ? "Demo data is saved in this browser. Windows offline cash sales use the installed app's local database." : "Transactions are saved to the shared shop backend. Browser sales require a connection; durable offline cash sales use the installed Windows app."}
      </p>
      <dl className="sync-summary">
        <dt>Connection</dt>
        <dd>{state.status}</dd>
        <dt>Last sync</dt>
        <dd>
          {state.lastSync
            ? new Date(state.lastSync).toLocaleTimeString()
            : "Not yet synchronized"}
        </dd>
        <dt>Pending changes</dt>
        <dd>{state.pending.length}</dd>
      </dl>
      {state.pending.map((item) => (
        <div className="auth-notice" key={item.id}>
          <strong>
            {item.status === "CONFLICT"
              ? "Needs Owner Review"
              :item.status==='FAILED'?'Failed — Retry Available':item.status==='SYNCING'?'Syncing'
              : item.type === "IMAGE_UPLOAD"
                ? "Photo waiting to upload"
                : "Cash sale waiting to sync"}
          </strong>
          <p>
            {item.error ||
              (item.type === "IMAGE_UPLOAD"
                ? "Your photo is safely stored locally."
                : "Your receipt and transaction are safely stored locally.")}
          </p>
          <small>Attempts: {item.attempts}</small>
        </div>
      ))}
      <Button onClick={state.retry}>Retry Synchronization</Button>
      <div className="mt-6"><CashExceptions/></div>
      <p className="text-sm text-muted mt-4">
        Conflicting stock, price, tax and authorization changes are never
        overwritten. Offline credit and electronic payment confirmation are
        unavailable.
      </p>
    </>
  );
}
export function DesktopSettings({ about = false }: { about?: boolean }) {
  const [autostart, setAutostart] = useState(false),
    [mode, setMode] = useState(
      localStorage.getItem("taha-counter-window-mode") || "normal",
    ),
    [address, setAddress] = useState(desktopConfig().backend),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const owner = useSessionStore((s) => s.profile?.role === "owner");
  useEffect(() => {
    if (nativeDesktop)
      void isEnabled()
        .then(setAutostart)
        .catch(() => undefined);
  }, []);
  if (about)
    return (
      <>
        <h3>Taha POS</h3>
        <p>TAHA MOBILES · Version {desktopConfig().version}</p>
        <p className="text-muted">
          {nativeDesktop
            ? "Bundled Windows application · SQLite local database"
            : localDemoEnabled ? "Browser development preview · Local demo database" : "Browser development preview · Shared shop backend"}
        </p>
        <p>
          Updates will require signed releases. Automatic updates are not
          enabled.
        </p>
      </>
    );
  if (!nativeDesktop)
    return (
      <p className="text-muted">
        Windows startup, window mode and secure backend settings are available
        in the installed Taha POS application.
      </p>
    );
  return (
    <>
      <div className="settings-row">
        <span>Launch Taha POS when Windows starts</span>
        <button
          disabled={!owner}
          role="switch"
          aria-checked={autostart}
          className={"toggle " + (autostart ? "checked" : "")}
          onClick={() =>
            void (autostart ? disable() : enable())
              .then(() => setAutostart(!autostart))
              .catch(() =>
                setError("Windows could not change the startup preference."),
              )
          }
        >
          <span />
        </button>
      </div>
      <Field label="Counter Mode"><AppSelect
          value={mode}
          onChange={(e) => {
            const next = e.target.value;
            const win = getCurrentWindow();
            void win
              .setFullscreen(next === "fullscreen")
              .then(() =>
                next === "maximized"
                  ? win.maximize()
                  : next === "normal"
                    ? win.unmaximize()
                    : undefined,
              )
              .then(() => {
                setMode(next);
                localStorage.setItem("taha-counter-window-mode", next);
              })
              .catch(() => setError("The window mode could not be changed."));
          }}
        >
          <option value="normal">Normal Window</option>
          <option value="maximized">Maximized</option>
          <option value="fullscreen">Fullscreen · press F11 to exit</option>
        </AppSelect></Field>
      {owner && (
        <>
          <h3 className="mt-6">Advanced · Backend Connection</h3>
          <p className="text-muted">
            Changing the shop backend signs out this Windows account.
            Synchronize pending changes first.
          </p>
          <label className="form-field">
            Shop backend
            <input
              className="input"
              type="url"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <Button onClick={() => setConfirm(true)}>Change Backend</Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirm}
        title="Change shop backend?"
        description="Confirm the new shop address. Your session will be cleared; queued sales must be synchronized first."
        confirm="Change Backend"
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          void invoke("desktop_backend", { address, confirmed: true })
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
