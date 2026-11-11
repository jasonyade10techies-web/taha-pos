import {TaxSettings} from './tax-settings';
import {SettingsPreferencesForm} from './settings-preferences-form';
import './settings-groups.css';
import {ShopSetup} from './shop-setup';
import {DesktopSettings,SynchronizationSettings} from './desktop-settings';
import {LocalBridgeSettings} from './local-bridge-settings';
import {SearchSettings} from './search-settings';
import {DevicesSettings} from "./devices-settings";
import {BridgeDiagnostics} from "../../components/devices/bridge-diagnostics";
import {bundledMobile} from "../../lib/mobile/runtime";
import { usePermission } from "../../hooks/use-permission";
import { useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  QueryState,
  ConfirmDialog,
  type FormField,
} from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { useUiStore } from "../../stores/ui-store";
import { useSessionStore } from "../../stores/session-store";
import { useCartStore } from "../../stores/cart-store";
import { AppearanceCustomizer } from "./appearance-customizer";
import { options } from "../shared/format";
import type { DemoSettings } from "../../types/demo";
import {localDemoEnabled} from "../../lib/config";
const sections = [
  "Shop Setup",
  "Synchronization", "Windows Application", "About",
  "Tax",
  "Search Dictionary",
  ...(bundledMobile?["Shop Connection"]:[]),
  "Diagnostics",
  "General",
  "Store",
  "Appearance",
  "POS",
  "Customer Display",
  "Mobile Camera",
  "Devices",
  "Touchscreen Keyboard",
  "Customer Selection",
  "Receipts",
  "Inventory",
  "Repairs",
  "Payments",
  "Returns",
  "Credit",
  "Notifications",
  "Data / Demo",
];
const groups:[string,string[]][]=[
 ['General',['General','Notifications','About']],['Shop',['Shop Setup','Store']],['POS',['POS','Touchscreen Keyboard','Customer Display']],
 ['Inventory',['Inventory','Search Dictionary']],['Repairs',['Repairs']],['Customers & Credit',['Customer Selection','Credit','Returns']],
 ['Payments',['Payments','Tax']],['Receipts',['Receipts']],['Devices',['Devices','Mobile Camera']],['Appearance',['Appearance']],
 ['Offline & Sync',['Synchronization']],['Advanced',['Windows Application','Shop Connection','Diagnostics','Data / Demo']],
];
const fieldGroups: Record<string, FormField[]> = {
  General: [
    {
      key: "currency",
      label: "Currency",
      type: "select",
      options: options(["PKR"]),
      required: true,
    },
    {
      key: "timezone",
      label: "Timezone",
      type: "select",
      options: options(["Asia/Karachi"]),
      required: true,
    },
  ],
  Store: [
    { key: "storeName", label: "Store name", required: true },
    { key: "branch", label: "Branch", required: true },
    {key:"phone",label:"Receipt phone"},{key:"address",label:"Receipt address"},
  ],
  POS: [
    { key: "bargaining", label: "Allow price bargaining", type: "checkbox" },
    {
      key: "belowMinimum",
      label: "Below-minimum pricing",
      type: "select",
      options: options(localDemoEnabled ? ["Manager Approval", "Block", "Allow with Reason"] : ["Manager Approval","Block"]),
      required: true,
    },
    {
      key: "customerDisplay",
      label: "Enable customer display",
      type: "checkbox",
    },
  ],
  "Customer Display": [
    { key: "customerDisplay", label: "Enable customer display", type: "checkbox" },
    { key: "customerDisplayFullscreen", label: "Fullscreen by default", type: "checkbox" },
    { key: "customerDisplayIdleTimeout", label: "Sale complete duration (seconds)", type: "number", min: 5, max: 60 },
    { key: "customerDisplayPromotions", label: "Show promotional cards", type: "checkbox" },
    { key: "customerDisplayPaymentQr", label: "Show payment QR", type: "checkbox" },
  ],
  "Mobile Camera": [
    { key: "mobileCameraEnabled", label: "Enable mobile camera requests", type: "checkbox" },
    { key: "mobileCameraRequireProof", label: "Require payment proof", type: "checkbox" },
    { key: "mobileCameraCompressImages", label: "Compress images", type: "checkbox" },
    { key: "mobileCameraImageQuality", label: "Image quality (%)", type: "number", min: 40, max: 100 },
  ],
  "Touchscreen Keyboard": [
    { key: "keyboardEnabled", label: "Enable on-screen keyboard", type: "checkbox" },
    { key: "keyboardOpenOnTouch", label: "Open automatically on touch", type: "checkbox" },
    { key: "keyboardNumericAmounts", label: "Use numeric keypad for amounts", type: "checkbox" },
    { key: "keyboardSize", label: "Keyboard size", type: "select", options: options(["Compact", "Large"]) },
  ],
  "Customer Selection": [
    { key: "defaultSaleCustomer", label: "Default sale customer", required: true },
    { key: "showRecentCustomers", label: "Show recent customers", type: "checkbox" },
    { key: "allowQuickAddCustomer", label: "Allow quick add customer", type: "checkbox" },
    { key: "requirePhoneForCredit", label: "Require phone for credit", type: "checkbox" },
  ],
  Receipts: [
    {
      key: "receiptPrinting",
      label: "Receipt printing behavior",
      type: "select",
      options: options([
        "Always Print",
        "Ask After Checkout",
        "Never Auto Print",
      ]),
      required: true,
    },
    { key: "receiptFooter", label: "Receipt footer", type: "textarea" },
  ],
  Inventory: [
    { key: "lowStockAlerts", label: "Low stock alerts", type: "checkbox" },
    ...(localDemoEnabled ? [{ key: "negativeStock", label: "Allow negative stock", type: "checkbox" as const }] : []),
    { key: "defaultUnit", label: "Default unit", required: true },
  ],
  Payments: [
    {
      key: "requireProof",
      label: "Require electronic payment proof",
      type: "checkbox",
    },
  ],
  Returns: [
    {
      key: "receiptRequired",
      label: "Original receipt required",
      type: "checkbox",
    },
    {
      key: "returnDays",
      label: "Return window (days)",
      type: "number",
      min: 0,
      required: true,
    },
    {
      key: "returnApproval",
      label:localDemoEnabled ? "Require demo manager approval" : "Require manager approval",
      type: "checkbox",
    },
    {
      key: "restoreReturns",
      label: "Default to restoring sellable stock",
      type: "checkbox",
    },
  ],
  Credit: [
    { key: "creditEnabled", label: "Enable credit sales", type: "checkbox" },
    {key:'creditDueRequired',label:'Require a due date on credit sales',type:'checkbox',help:'Does not change customer credit limits.'},
    {key:'remindersEnabled',label:'Enable manual reminders and due alerts',type:'checkbox',help:'Staff review and manually send messages. No automatic WhatsApp sending.'},
    {key:'reminderWarningDays',label:'Warn before due date (days)',type:'number',min:0,max:30},
  ],
  Notifications: [
    {
      key: "notifications",
      label: "Enable in-app notifications",
      type: "checkbox",
    },
  ],
};
export function SettingsPage() {
  const a = useAction();
  const canManage = usePermission("settings.manage"), canAppearance = usePermission("appearance.customize"), canPair = usePermission("devices.pair"), canReconcile=usePermission('sync.reconcile_cash');
  const [params,setParams] = useSearchParams();
  const requestedSection = params.get("section");
  const accessible=sections.filter(s => canManage || (s === "Appearance" && canAppearance) || (s === "Devices" && canPair) || (s==='Synchronization'&&canReconcile));
  const section = requestedSection && accessible.includes(requestedSection) ? requestedSection : canManage ? "General" : canAppearance ? "Appearance" : canPair?'Devices':'Synchronization';
  const q=useRepository('settings',()=>r.settings.get(),section!=='Synchronization');
  const setSection = (value:string) => setParams({section:value},{replace:true});
  const [reset, setReset] = useState(false);
  const offline = useSessionStore((s) => s.simulatedOffline);
  return (
    <>
      <PageHeader
        title="Settings"
        action={canManage&&<Button onClick={()=>setSection('Shop Setup')}>Review Shop Setup</Button>}
        subtitle={localDemoEnabled ? "Store preferences saved in this local demo." : "Manage the shop’s appearance, counter preferences and connected devices."}
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {groups.filter(([,items])=>items.some(item=>accessible.includes(item))).map(([group,items])=><div className="settings-nav-group" key={group}><h3>{group}</h3>{items.filter(item=>accessible.includes(item)).map((s) => (
            <button
              key={s}
              className={section === s ? "active" : ""}
              onClick={() => setSection(s)}
            >
              {s}
            </button>
          ))}</div>)}
        </nav>
        <QueryState
          pending={section!=='Synchronization'&&q.isPending}
          error={section!=='Synchronization'&&q.isError}
          retry={() => void q.refetch()}
        >
          <section className={'panel form-section settings-content '+(['Devices','Appearance','Diagnostics','Synchronization','Windows Application'].includes(section)?'settings-content-wide':'')}>
            <h2>{section}</h2>
            {section === "Shop Setup" ? (q.data&&<ShopSetup settings={q.data}/>) : section === "Synchronization" ? <SynchronizationSettings/> : section === "Windows Application" ? <><DesktopSettings/><LocalBridgeSettings/></> : section === "About" ? <DesktopSettings about/> : section === "Tax" ? (q.data&&<TaxSettings key={JSON.stringify(q.data.taxProfiles)} settings={q.data}/>) : section === "Search Dictionary" ? (q.data&&<SearchSettings key={JSON.stringify(q.data.searchDictionary)} settings={q.data}/>) : section === "Repairs" ? <div className="detail-grid"><p>Manage repair services and jobs using their existing workflows. Review Shop Setup to enable or disable repairs without altering history.</p><Link className="text-link" to="/services">Repair Services</Link><Link className="text-link" to="/repair-jobs">Repair Jobs</Link><Button onClick={()=>setSection("Shop Setup")}>Review repair setup</Button></div> : section === "Appearance" ? (
              q.data && <AppearanceCustomizer settings={q.data}/>
            ) : section === "Diagnostics" ? <BridgeDiagnostics/> : section === "Shop Connection" ? <Button variant="primary" onClick={()=>location.hash="/shop-connection"}>Open {section}</Button> : section === "Devices" ? <DevicesSettings/> : section === "Data / Demo" && !localDemoEnabled ? <div className="auth-notice"><strong>Shared Shop Data</strong><p>Business transactions are recorded in the shared backend. Browser sales need a connection. The installed Windows app retains permitted offline cash sales for synchronization and owner reconciliation.</p></div> : section === "Data / Demo" ? (
              <>
                <div className="auth-notice">
                  <strong>LOCAL DEMO MODE</strong>
                  <p>
                    Business data persists in this browser's IndexedDB. There is
                    no connected backend or production authentication. Demo PIN:
                    123456.
                  </p>
                </div>
                <div className="settings-row">
                  <span>Preview offline mode</span>
                  <button
                    role="switch"
                    aria-label="Preview offline mode"
                    aria-checked={offline}
                    className={"toggle " + (offline ? "checked" : "")}
                    onClick={() =>
                      useSessionStore.getState().setSimulatedOffline(!offline)
                    }
                  >
                    <span />
                  </button>
                </div>
                <Button onClick={() => setReset(true)}>Reset Demo Data</Button>
              </>
            ) : (
              q.data && (
                <SettingsPreferencesForm
                  key={section + JSON.stringify(q.data)}
                  fields={fieldGroups[section] ?? []}
                  initial={Object.fromEntries(Object.entries(q.data))}
                  busy={a.busy}
                  onSubmit={(v) =>
                    void a.run(
                      () =>
                        r.settings.save({ ...q.data, ...v, ...(section === "Mobile Camera" ? {requireProof:Boolean(v.mobileCameraRequireProof)} : section === "Payments" ? {mobileCameraRequireProof:Boolean(v.requireProof)} : {}) } as DemoSettings),
                      "Settings saved",
                      () => {
                        if (section === "Touchscreen Keyboard") {
                          useUiStore.getState().setKeyboardEnabled(Boolean(v.keyboardEnabled));
                          useUiStore.getState().setKeyboardPreferences({keyboardOpenOnTouch:Boolean(v.keyboardOpenOnTouch),keyboardNumericAmounts:Boolean(v.keyboardNumericAmounts),keyboardSize:v.keyboardSize === "Large" ? "Large" : "Compact"});
                        }
                        if (section === "Customer Display" && typeof v.customerDisplayFullscreen === "boolean") useUiStore.getState().setCustomerDisplayFullscreen(v.customerDisplayFullscreen);
                      },
                    )
                  }
                />
              )
            )}
          </section>
        </QueryState>
      </div>
      <ConfirmDialog
        open={reset}
        title="Reset demo data?"
        description="This removes all local prototype changes and restores the seeded catalog and history on this device."
        confirm="Reset Demo Data"
        onClose={() => setReset(false)}
        busy={a.busy}
        onConfirm={() =>
          void a.run(
            () => r.reset(),
            "Demo data restored",
            () => {
              useCartStore.getState().clear();
              sessionStorage.setItem("taha-demo-employee", "owner-1");
              setReset(false);
              window.dispatchEvent(new Event("taha-session-refresh"));
            },
          )
        }
      />
    </>
  );
}
