import {OfflineDraftSync} from '../components/layout/offline-draft-sync';
import {DesktopSync} from '../components/layout/desktop-sync';
import { apiEnabled } from "../lib/config";
import { bundledMobile } from "../lib/mobile/runtime";

import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  HashRouter,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { isTauri } from "@tauri-apps/api/core";
import { MotionConfig } from "framer-motion";
import { AppShell } from "../components/layout/app-shell";

import { ToastHost } from "../components/ui/feedback";

import { useTheme } from "../hooks/use-theme";
import { ErrorBoundary } from "./error-boundary";
import { DeviceBridgeProvider } from "../components/devices/device-bridge-provider";
import { AuthProvider } from "../features/auth/auth-provider";
import {
  ProtectedRoute,
  PermissionGuard,
  HomeRedirect,
} from "../features/auth/route-guards";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: false, refetchOnWindowFocus: false },
  },
});
// Hash routing keeps packaged desktop refreshes independent of an HTTP SPA fallback.
const Router = isTauri() || bundledMobile ? HashRouter : BrowserRouter;
// Load only the requested management screen instead of every desktop module at startup.
const CustomersPage = lazy(() =>
  import("../features/customers/customers-page").then((m) => ({
    default: m.CustomersPage,
  })),
);
const ProductsPage = lazy(() =>
  import("../features/inventory/products-page").then((m) => ({
    default: m.ProductsPage,
  })),
);
const ProductFormPage = lazy(() =>
  import("../features/inventory/products-page").then((m) => ({
    default: m.ProductFormPage,
  })),
);
const ProductDetailPage = lazy(() =>
  import("../features/inventory/products-page").then((m) => ({
    default: m.ProductDetailPage,
  })),
);
const LocationsPage = lazy(() =>
  import("../features/inventory/locations-page").then((m) => ({
    default: m.LocationsPage,
  })),
);
const LocationDetailPage = lazy(() =>
  import("../features/inventory/locations-page").then((m) => ({
    default: m.LocationDetailPage,
  })),
);
const StockPage = lazy(() =>
  import("../features/inventory/stock-pages").then((m) => ({
    default: m.StockPage,
  })),
);
const ReceivingPage = lazy(() =>
  import("../features/inventory/stock-pages").then((m) => ({
    default: m.ReceivingPage,
  })),
);
const TransfersPage = lazy(() =>
  import("../features/inventory/stock-pages").then((m) => ({
    default: m.TransfersPage,
  })),
);
const TransactionsPage = lazy(() =>
  import("../features/sales/transactions-page").then((m) => ({
    default: m.TransactionsPage,
  })),
);
const TransactionDetailPage = lazy(() =>
  import("../features/sales/transactions-page").then((m) => ({
    default: m.TransactionDetailPage,
  })),
);
const ReturnsPage = lazy(() =>
  import("../features/sales/transactions-page").then((m) => ({
    default: m.ReturnsPage,
  })),
);
const CreditPage = lazy(() =>
  import("../features/credit/credit-pages").then((m) => ({
    default: m.CreditPage,
  })),
);
const CustomerFormPage = lazy(() =>
  import("../features/credit/credit-pages").then((m) => ({
    default: m.CustomerFormPage,
  })),
);
const CreditDetailPage = lazy(() =>
  import("../features/credit/credit-pages").then((m) => ({
    default: m.CreditDetailPage,
  })),
);
const TestPage = lazy(() =>
  import("../features/credit/test-page").then((m) => ({ default: m.TestPage })),
);
const ServicesPage = lazy(() =>
  import("../features/services/service-pages").then((m) => ({
    default: m.ServicesPage,
  })),
);
const RepairJobsPage = lazy(() =>
  import("../features/services/service-pages").then((m) => ({
    default: m.RepairJobsPage,
  })),
);
const RepairJobPage = lazy(() =>
  import("../features/services/service-pages").then((m) => ({
    default: m.RepairJobPage,
  })),
);
const BuyDevicePage = lazy(() =>
  import("../features/purchasing/purchasing-pages").then((m) => ({
    default: m.BuyDevicePage,
  })),
);
const PurchasedDevicesPage = lazy(() =>
  import("../features/purchasing/purchasing-pages").then((m) => ({
    default: m.PurchasedDevicesPage,
  })),
);
const DeviceDetailPage = lazy(() =>
  import("../features/purchasing/purchasing-pages").then((m) => ({
    default: m.DeviceDetailPage,
  })),
);
const SuppliersPage = lazy(() =>
  import("../features/purchasing/purchasing-pages").then((m) => ({
    default: m.SuppliersPage,
  })),
);
const EmployeesPage = lazy(() =>
  import("../features/employees/employee-pages").then((m) => ({
    default: m.EmployeesPage,
  })),
);
const EmployeeDetailPage = lazy(() =>
  import("../features/employees/employee-pages").then((m) => ({
    default: m.EmployeeDetailPage,
  })),
);
const ShiftsPage = lazy(() =>
  import("../features/employees/shifts-page").then((m) => ({
    default: m.ShiftsPage,
  })),
);
const CouponsPage = lazy(() =>
  import("../features/admin/catalog-pages").then((m) => ({
    default: m.CouponsPage,
  })),
);
const PaymentsPage = lazy(() =>
  import("../features/admin/catalog-pages").then((m) => ({
    default: m.PaymentsPage,
  })),
);
const WebsiteProductsPage = lazy(() =>
  import("../features/admin/website-pages").then((m) => ({
    default: m.WebsiteProductsPage,
  })),
);
const EnquiriesPage = lazy(() =>
  import("../features/admin/website-pages").then((m) => ({
    default: m.EnquiriesPage,
  })),
);
const ReportsPage = lazy(() =>
  import("../features/reports/reports-page").then((m) => ({
    default: m.ReportsPage,
  })),
);
const AuditPage = lazy(() =>
  import("../features/reports/audit-page").then((m) => ({
    default: m.AuditPage,
  })),
);
const ProductImportPage = lazy(() =>
  import("../features/inventory/import-page").then((m) => ({
    default: m.ProductImportPage,
  })),
);
const ServiceFormPage = lazy(() =>
  import("../features/services/service-form-page").then((m) => ({
    default: m.ServiceFormPage,
  })),
);
const SupplierDetailPage = lazy(() =>
  import("../features/purchasing/supplier-detail-page").then((m) => ({
    default: m.SupplierDetailPage,
  })),
);
const DashboardPage = lazy(() =>
  import("../features/dashboard/dashboard-page").then((m) => ({
    default: m.DashboardPage,
  })),
);
const PosPage = lazy(() =>
  import("../features/pos/pos-page").then((m) => ({ default: m.PosPage })),
);
const SettingsPage = lazy(() =>
  import("../features/settings/settings-page").then((m) => ({
    default: m.SettingsPage,
  })),
);
const CustomerDisplayPage = lazy(() =>
  import("../features/pos/customer-display-page").then((m) => ({
    default: m.CustomerDisplayPage,
  })),
);
const MobileCameraPage = lazy(() =>
  import("../features/pos/mobile-camera-page").then((m) => ({
    default: m.MobileCameraPage,
  })),
);
const LoginPage = lazy(() =>
  import("../features/auth/login-page").then((m) => ({ default: m.LoginPage })),
);
const CounterPage = lazy(() =>
  import("../features/auth/counter-page").then((m) => ({
    default: m.CounterPage,
  })),
);
const ProfilePage = lazy(() =>
  import("../features/auth/profile-page").then((m) => ({
    default: m.ProfilePage,
  })),
);
const AuthCallbackPage = lazy(() =>
  import("../features/auth/auth-callback-page").then((m) => ({
    default: m.AuthCallbackPage,
  })),
);
const StaffApp = lazy(() =>
  import("./mobile-app").then((m) => ({ default: m.MobileApp })),
);
const loading = (
  <p className="p-8 text-muted" role="status">
    Opening workspace…
  </p>
);
export function App() {
  useTheme();
  const path =
    isTauri() || bundledMobile
      ? location.hash.slice(1).split("?")[0]
      : location.pathname;
  if (
    ((import.meta.env.VITE_DEPLOYMENT_ENV==='staging' || import.meta.env.VITE_DEPLOYMENT_ENV==='production') && !isTauri() && !bundledMobile && window.innerWidth < 768 && path !== '/customer-display') ||
    path.startsWith("/mobile") ||
    path === "/camera" ||
    path === "/alerts" ||
    (window.innerWidth < 768 && (path === "/profile" || path === "/login"))
  )
    return (
      <Suspense fallback={loading}>
        <StaffApp />
      </Suspense>
    );
  // The dedicated customer window never restores a staff session or fetches business queries.
  if (apiEnabled && path === "/customer-display")
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Router>
            <Suspense fallback={loading}>
              <CustomerDisplayPage />
            </Suspense>
          </Router>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MotionConfig reducedMotion="user">
            <Router>
              <DeviceBridgeProvider>
                <Routes>
                  <Route
                    path="/mobile"
                    element={<Navigate to="/mobile-camera" replace />}
                  />
                  <Route
                    path="/camera"
                    element={<Navigate to="/mobile-camera" replace />}
                  />
                  <Route
                    path="/alerts"
                    element={<Navigate to="/mobile-camera" replace />}
                  />
                  <Route
                    path="/login"
                    element={
                      <Suspense fallback={loading}>
                        <LoginPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/auth/callback"
                    element={
                      <Suspense fallback={loading}>
                        <AuthCallbackPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/counter"
                    element={
                      <Suspense fallback={loading}>
                        <CounterPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/customer-display"
                    element={
                      <Suspense fallback={loading}>
                        <CustomerDisplayPage />
                      </Suspense>
                    }
                  />
                  <Route element={<ProtectedRoute />}>
                    <Route
                      path="/mobile-camera"
                      element={
                        <Suspense fallback={loading}>
                          <MobileCameraPage />
                        </Suspense>
                      }
                    />
                  </Route>
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<HomeRedirect />} />
                      <Route
                        path="/dashboard"
                        element={
                          <PermissionGuard>
                            <Suspense fallback={loading}>
                              <DashboardPage />
                            </Suspense>
                          </PermissionGuard>
                        }
                      />
                      <Route
                        path="/pos"
                        element={
                          <PermissionGuard>
                            <Suspense fallback={loading}>
                              <PosPage />
                            </Suspense>
                          </PermissionGuard>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <PermissionGuard>
                            <Suspense fallback={loading}>
                              <SettingsPage />
                            </Suspense>
                          </PermissionGuard>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <Suspense fallback={loading}>
                            <ProfilePage />
                          </Suspense>
                        }
                      />
                      {[
                        ["/products", <ProductsPage />],
                        ["/products/import", <ProductImportPage />],
                        ["/products/new", <ProductFormPage />],
                        ["/products/:id", <ProductDetailPage />],
                        ["/products/:id/edit", <ProductFormPage />],
                        ["/inventory", <Navigate to="/stock" replace />],
                        ["/stock", <StockPage />],
                        ["/low-stock", <StockPage low />],
                        ["/locations", <LocationsPage />],
                        ["/locations/:id", <LocationDetailPage />],
                        ["/stock-receiving", <ReceivingPage />],
                        ["/transfers", <TransfersPage />],
                        ["/transactions", <TransactionsPage />],
                        ["/transactions/:id", <TransactionDetailPage />],
                        [
                          "/sale-complete/:id",
                          <TransactionDetailPage complete />,
                        ],
                        ["/returns", <ReturnsPage />],
                        ["/customers", <CustomersPage />],
                        ["/customers/new", <CustomerFormPage />],
                        ["/customers/:id", <CreditDetailPage />],
                        ["/customers/:id/edit", <CustomerFormPage />],
                        ["/credit", <CreditPage />],
                        ["/credit/new", <CustomerFormPage />],
                        ["/credit/:id", <CreditDetailPage />],
                        ["/credit/:id/edit", <CustomerFormPage />],
                        ["/out-for-test", <TestPage />],
                        ["/services", <ServicesPage />],
                        ["/services/new", <ServiceFormPage />],
                        ["/services/:id/edit", <ServiceFormPage />],
                        ["/repair-jobs", <RepairJobsPage />],
                        ["/repair-jobs/new", <RepairJobPage />],
                        ["/repair-jobs/:id", <RepairJobPage />],
                        ["/buy-device", <BuyDevicePage />],
                        ["/purchased-devices", <PurchasedDevicesPage />],
                        ["/purchased-devices/:id", <DeviceDetailPage />],
                        ["/suppliers", <SuppliersPage />],
                        ["/suppliers/:id", <SupplierDetailPage />],
                        ["/employees", <EmployeesPage />],
                        ["/employees/:id", <EmployeeDetailPage />],
                        ["/shifts", <ShiftsPage />],
                        ["/coupons", <CouponsPage />],
                        ["/payments", <PaymentsPage />],
                        ["/payment-methods", <PaymentsPage />],
                        ["/reports", <ReportsPage />],
                        ["/audit-log", <AuditPage />],
                        ["/website-products", <WebsiteProductsPage />],
                        ["/repair-enquiries", <EnquiriesPage />],
                      ].map(([path, element]) => (
                        <Route
                          key={String(path)}
                          path={String(path)}
                          element={
                            <PermissionGuard>
                              <Suspense fallback={loading}>{element}</Suspense>
                            </PermissionGuard>
                          }
                        />
                      ))}
                      <Route
                        path="*"
                        element={
                          <section className="panel empty-state">
                            <h1>Page not found</h1>
                            <a className="text-link" href="/dashboard">
                              Return to Dashboard
                            </a>
                          </section>
                        }
                      />
                    </Route>
                  </Route>
                </Routes>
                <OfflineDraftSync/>
                <DesktopSync/>
                <ToastHost />
              </DeviceBridgeProvider>
            </Router>
          </MotionConfig>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
