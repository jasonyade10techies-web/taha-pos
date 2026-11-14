import {AppUpdatesPage} from "./app-updates-page";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ConnectionPage, DiagnosticsPage } from "./shop-connection";
import { MobileShell } from "./mobile-shell";
import { MobileLoginPage } from "./mobile-login-page";
import { useSessionStore } from "../../stores/session-store";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { apiAuth } from "../../lib/api/client";
import { permitted } from "../../lib/permissions";
import type { PermissionKey } from "../../types/auth";
import {bundledMobile} from '../../lib/mobile/runtime';
import {FirstRunSetupPage,FirstRunTaxPage} from '../settings/first-run-setup';
const SetupLocations=lazy(()=>import('../inventory/locations-page').then(module=>({default:module.LocationsPage})));
const SetupPayments=lazy(()=>import('../admin/catalog-pages').then(module=>({default:module.PaymentsPage})));
const Home = lazy(() =>
    import("./mobile-home-page").then((m) => ({ default: m.MobileHomePage })),
  ),
  Activity = lazy(() =>
    import("./mobile-activity-page").then((m) => ({
      default: m.MobileActivityPage,
    })),
  ),
  Devices = lazy(() =>
    import("./mobile-devices-page").then((m) => ({
      default: m.MobileDevicesPage,
    })),
  ),
  Profile = lazy(() =>
    import("./mobile-profile-page").then((m) => ({
      default: m.MobileProfilePage,
    })),
  ),
  Products = lazy(() =>
    import("./mobile-products-page").then((m) => ({
      default: m.MobileProductsPage,
    })),
  ),
  Inventory = lazy(() =>
    import("./mobile-inventory-page").then((m) => ({
      default: m.MobileInventoryPage,
    })),
  ),
  Settings = lazy(() =>
    import("./mobile-settings-page").then((m) => ({
      default: m.MobileSettingsPage,
    })),
  ),
  Display = lazy(() =>
    import("./mobile-display-page").then((m) => ({
      default: m.MobileDisplayPage,
    })),
  ),
  Reports = lazy(() =>
    import("./mobile-reports-page").then((m) => ({
      default: m.MobileReportsPage,
    })),
  );
const Receipt = lazy(() =>
  import("./mobile-receipt-page").then((m) => ({
    default: m.MobileReceiptPage,
  })),
);
const Sales = lazy(() => import('./mobile-sales-page').then(m=>({default:m.MobileSalesPage})));
function Guard({ permission }: { permission?: PermissionKey }) {
  const session = useSessionStore(),
    location = useLocation();
  if (session.authStatus === "loading")
    return (
      <div className="staff-empty" role="status">
        Opening your workspace…
      </div>
    );
  if (session.authStatus !== "authenticated")
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (
    permission &&
    !permitted(session.profile, session.permissions, permission)
  )
    return (
      <section className="staff-empty">
        <h1>Access Denied</h1>
        <p>Your account does not have permission to open this tool.</p>
      </section>
    );
  return <Outlet />;
}
function Logout() {
  const [switching, setSwitching] = useState(false),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    navigate = useNavigate();
  useEffect(() => {
    const show = () => {
        setSwitching(false);
        setOpen(true);
      },
      switchUser = () => {
        setSwitching(true);
        setOpen(true);
      };
    window.addEventListener("taha-mobile-logout", show);
    window.addEventListener("taha-mobile-switch", switchUser);
    return () => {
      window.removeEventListener("taha-mobile-logout", show);
      window.removeEventListener("taha-mobile-switch", switchUser);
    };
  }, []);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={switching ? "Switch Employee?" : "Sign out of account?"}
      description={
        switching
          ? "Sign in with the next employee’s account. Saved private information will be cleared."
          : "Cached shop information and unsent private photos will be cleared from this phone."
      }
    >
      <div className="dialog-actions">
        <Button onClick={() => setOpen(false)}>Cancel</Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void apiAuth.logout().finally(() => {
              window.dispatchEvent(new Event("taha-session-clear"));
              setOpen(false);
              setBusy(false);
              navigate("/login", { replace: true });
            });
          }}
        >
          Sign Out
        </Button>
      </div>
    </Dialog>
  );
}
export function MobileRoutes() {
  useEffect(()=>{if(!bundledMobile||!window.TahaNative?.checkUpdates)return;const now=Date.now(),last=Number(sessionStorage.getItem('taha-update-checked')||0);if(now-last>21600000){sessionStorage.setItem('taha-update-checked',String(now));window.TahaNative.checkUpdates(1);}},[]);
  return (
    <>
      <Suspense
        fallback={
          <div className="staff-empty" role="status">
            Opening…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/mobile" replace />} />
          <Route path="/dashboard" element={<Navigate to="/mobile" replace />} />
          <Route path="/pos" element={<Navigate to="/mobile/sales" replace />} />
          <Route path="/products" element={<Navigate to="/mobile/products" replace />} />
          <Route path="/settings" element={<Navigate to="/mobile/settings" replace />} />
          <Route path="/login" element={<MobileLoginPage />} />
          <Route path="/mobile/updates" element={<AppUpdatesPage/>}/>
          <Route element={<Guard />}>
            <Route element={<MobileShell />}>
              <Route path="/setup" element={<FirstRunSetupPage mobile/>}/>
              <Route path="/setup/tax" element={<FirstRunTaxPage/>}/>
              <Route element={<Guard permission="inventory.view"/>}><Route path="/locations" element={<SetupLocations/>}/></Route>
              <Route element={<Guard permission="settings.manage"/>}><Route path="/payment-methods" element={<SetupPayments/>}/></Route>
              <Route path="/mobile" element={<Home />} />
              <Route path="/mobile/activity" element={<Activity />} />
              <Route path="/mobile/devices" element={<Devices />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/mobile/settings" element={<Settings />} />
              <Route
                path="/mobile/shop-connection"
                element={bundledMobile ? <ConnectionPage /> : <Navigate to="/mobile/settings" replace />}
              />
              <Route path="/mobile/diagnostics" element={bundledMobile ? <DiagnosticsPage /> : <Navigate to="/mobile/settings" replace />} />
              <Route element={<Guard permission="inventory.view" />}>
                <Route path="/mobile/products" element={<Products />} />
                <Route path="/mobile/inventory" element={<Inventory />} />
              </Route>
              <Route element={<Guard permission="reports.view" />}>
                <Route path="/mobile/reports" element={<Reports />} />
              </Route>
              <Route element={<Guard permission="sales.view" />}>
                <Route path="/mobile/receipt" element={<Receipt />} />
                <Route path="/mobile/display" element={<Display />} />
              </Route>
              <Route element={<Guard permission="sales.create" />}>
                <Route path="/mobile/sales" element={<Sales />} />
              </Route>
            </Route>
          </Route>
          <Route path="/mobile-camera" element={<LegacyRedirect />} />
          <Route
            path="/camera"
            element={<Navigate to="/mobile/activity" replace />}
          />
          <Route
            path="/alerts"
            element={<Navigate to="/mobile/activity?tab=alerts" replace />}
          />
          <Route path="*" element={<Navigate to="/mobile" replace />} />
        </Routes>
      </Suspense>
      <Logout />
    </>
  );
}
function LegacyRedirect() {
  const location = useLocation();
  return <Navigate to={"/mobile/activity" + location.search} replace />;
}
