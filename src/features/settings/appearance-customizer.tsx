import { AppCheckbox } from '../../components/ui/app-checkbox';
import { useEffect, useState } from "react";
import { useUiStore } from "../../stores/ui-store";
import { appearanceErrors, colorText, defaultAppearance, type Appearance } from "../../lib/appearance";
import { Button } from "../../components/ui/button";
import { usePermission } from "../../hooks/use-permission";
import { useAction } from "../../hooks/use-repository";
import { repositories } from "../../lib/repositories";
import { apiEnabled } from "../../lib/config";
import { write } from "../../lib/api/catalog-repositories";
import type { DemoSettings } from "../../types/demo";

export function AppearanceCustomizer({ settings }: { settings: DemoSettings }) {
  const saved = useUiStore(s => s.appearance), setAppearance = useUiStore(s => s.setAppearance), preview = useUiStore(s => s.previewColors);
  const [draft, setDraft] = useState<Appearance>(settings.appearance ?? saved);
  const [dirty, setDirty] = useState(false);
  const theme = useUiStore(s => s.theme), setTheme = useUiStore(s => s.setTheme);
  const collapsed = useUiStore(s => s.sidebarCollapsed), toggleSidebar = useUiStore(s => s.toggleSidebar);
  const canSettings = usePermission("settings.manage"), canAppearance = usePermission("appearance.customize"), action = useAction();
  const canEdit = canSettings || canAppearance;
  const errors = appearanceErrors(draft);
  useEffect(() => { if (dirty && !errors.length) preview(draft); return () => preview(null); }, [draft, dirty, errors.length, preview]);
  const change = (patch: Partial<Appearance>) => { setDraft(old => ({ ...old, ...patch })); setDirty(true); };
  return <div className="appearance-customizer"><p className="text-muted">Preview fonts and colors throughout the workspace. Changes apply after you save.</p>
    <div className="theme-options mt-4">{(["light", "dark", "system"] as const).map(t => <button key={t} aria-pressed={theme === t} className={theme === t ? "selected" : ""} onClick={() => setTheme(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
    <label className="permission-toggle mt-4"><span>Compact sidebar</span><AppCheckbox type="checkbox" role="switch" checked={collapsed} onChange={toggleSidebar}/></label>
    <fieldset disabled={!canEdit || action.busy}><legend>Font family</legend><div className="theme-options">{(["Manrope", "Inter", "System"] as const).map(font => <button key={font} type="button" aria-pressed={draft.font === font} className={draft.font === font ? "selected" : ""} onClick={() => change({ font })}>{font === "System" ? "System Default" : font}</button>)}</div>
    <div className="appearance-colors">{(["primary", "accent", "success", "warning", "danger"] as const).map(key => <label key={key} className="form-field"><span>{key[0].toUpperCase() + key.slice(1)}</span><div><input type="color" aria-label={`${key} color picker`} value={draft[key]} onChange={e => change({ [key]: e.target.value })}/><input className="input" aria-label={`${key} hex color`} value={draft[key]} maxLength={7} onChange={e => change({ [key]: e.target.value })}/></div></label>)}</div></fieldset>
    <div className="appearance-preview panel"><span className="eyebrow">LIVE PREVIEW</span><h3 style={{ fontFamily: draft.font === "System" ? "system-ui" : draft.font }}>Ready for the next customer</h3><p>Clear totals, readable statuses, and familiar counter actions.</p><span style={{ background: draft.primary, color: colorText(draft.primary) }} className="appearance-sample-button">CHECKOUT · PKR 12,500</span></div>
    {errors.length > 0 && <div className="auth-notice" role="alert">{errors.map(e => <p key={e}>{e}</p>)}</div>}{action.error && <p role="alert" className="text-danger">{action.error}</p>}
    <div className="dialog-actions"><Button onClick={() => { setDraft(settings.appearance ?? saved); setDirty(false); preview(null); }}>Cancel</Button><Button onClick={() => change(defaultAppearance)} disabled={!canEdit}>Reset to Taha Default</Button><Button variant="primary" disabled={!canEdit || !dirty || errors.length > 0 || action.busy} onClick={() => void action.run(() => apiEnabled ? write("/appearance", draft, "PUT") : repositories.settings.save({ ...settings, appearance: draft }), "Appearance saved", () => { setAppearance(draft); setDirty(false); })}>Save Appearance</Button></div>
  </div>;
}
