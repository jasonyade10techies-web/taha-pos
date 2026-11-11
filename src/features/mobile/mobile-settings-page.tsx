import { AppCheckbox } from '../../components/ui/app-checkbox';
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Wifi,
  Camera,
  Shield,
  Settings,
  UserRound,
  ScanLine,
  Smartphone,
  Palette,
} from "lucide-react";
import {
  useMobilePreferences,
  mobileTabs,
  type MobileTab,
} from "../../stores/mobile-preferences-store";
import { useSessionStore } from "../../stores/session-store";
import { useUiStore } from "../../stores/ui-store";
import { Button } from "../../components/ui/button";
import { SheetSelect } from "../../components/ui/sheet-select";
import { clearReadCache } from "../../lib/mobile/read-cache";
import { toast } from "../../stores/toast-store";
import {bundledMobile} from '../../lib/mobile/runtime';

export function MobileSettingsPage() {
  const prefs = useMobilePreferences(),
    ui = useUiStore(),
    owner = useSessionStore((s) => s.profile?.role === "owner");
  const [selected, setSelected] = useState(prefs.tabs);
  return (
    <div className="staff-page">
      <div className="staff-page-heading">
        <span className="eyebrow">STAFF APP</span>
        <h1>Settings</h1>
        <p>Your phone preferences.</p>
      </div>
      <section className="staff-section">
        <h2>Account &amp; Devices</h2>
        <div className="panel staff-settings-list">
          <Link to="/profile">
            <UserRound size={20} />
            <span>Profile &amp; Account</span>
            <ChevronRight size={18} />
          </Link>
          <Link to="/mobile/devices">
            <Smartphone size={20} />
            <span>Connected Devices</span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>
      <section className="staff-section">
        <h2>
          <Palette size={18} />
          Appearance
        </h2>
        <SheetSelect
          label="Theme"
          value={ui.theme}
          options={["light", "dark", "system"].map((value) => ({
            value,
            label: value[0].toUpperCase() + value.slice(1),
          }))}
          onChange={(value) => ui.setTheme(value as typeof ui.theme)}
        />
      </section>
      <section className="staff-section">
        <h2>
          <ScanLine size={18} />
          Scanner
        </h2>
        <div className="panel staff-detail-list">
          <p className="staff-cache-label">
            Auto recognizes Taha QR codes and product barcodes. Choose QR or
            Barcode in the scanner for a specific task.
          </p>
          <Button
            onClick={() => window.dispatchEvent(new Event("taha-scan-open"))}
          >
            <ScanLine size={18} />
            Open Scanner
          </Button>
        </div>
      </section>
      {bundledMobile && <section className="staff-section">
        <h2>
          <Camera size={18} />
          Camera &amp; Photos
        </h2>
        <label className="panel staff-setting-toggle">
          <span>
            <strong>Save Captured Photos to Device Gallery</strong>
            <small>Optional copy of photos taken in this app.</small>
          </span>
          <AppCheckbox
            type="checkbox"
            checked={prefs.saveToGallery}
            onChange={(e) => prefs.setSaveToGallery(e.target.checked)}
          />
        </label>
      </section>}
      {bundledMobile && <section className="staff-section">
        <h2>
          <Shield size={18} />
          Offline Access
        </h2>
        <label className="panel staff-setting-toggle">
          <span>
            <strong>Save Read-only Shop Information</strong>
            <small>
              Private to this account. Cleared on sign out; expires after 8
              hours.
            </small>
          </span>
          <AppCheckbox
            type="checkbox"
            checked={prefs.offlineCache}
            onChange={(e) => {
              prefs.setOfflineCache(e.target.checked);
              if (!e.target.checked) void clearReadCache();
            }}
          />
        </label>
        <Button
          variant="ghost"
          onClick={() =>
            void clearReadCache().then(() => toast("Saved information cleared"))
          }
        >
          Clear Saved Information
        </Button>
      </section>}
      {owner && (
        <section className="staff-section">
          <h2>Mobile Navigation</h2>
          <p className="staff-cache-label">
            Choose up to 4 tabs. Scan stays in the center.
          </p>
          <div className="panel staff-tab-options">
            {mobileTabs.map((tab: MobileTab) => (
              <label key={tab}>
                <AppCheckbox
                  type="checkbox"
                  checked={selected.includes(tab)}
                  disabled={!selected.includes(tab) && selected.length >= 4}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, tab]
                        : selected.filter((t) => t !== tab),
                    )
                  }
                />
                {tab}
              </label>
            ))}
          </div>
          <Button
            variant="primary"
            disabled={!selected.length || selected.length > 4}
            onClick={() => {
              prefs.setTabs(selected);
              toast("Mobile navigation updated");
            }}
          >
            Save Navigation
          </Button>
        </section>
      )}
      {bundledMobile && <section className="staff-section">
        <h2>Shop &amp; Advanced</h2>
        <div className="panel staff-settings-list">
          <Link to="/mobile/shop-connection">
            <Wifi size={20} />
            <span>Shop Connection</span>
            <ChevronRight size={18} />
          </Link>
          <Link to="/mobile/diagnostics">
            <Settings size={20} />
            <span>Advanced / Diagnostics</span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>}
    </div>
  );
}
