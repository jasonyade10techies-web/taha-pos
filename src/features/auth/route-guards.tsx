import { Navigate, Outlet, useLocation, Link } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { useSessionStore } from "../../stores/session-store";
import { canOpenRoute, homeRoute } from "./route-access";
import type { ReactNode } from "react";
import { localDemoEnabled } from "../../lib/config";
export function ProtectedRoute() {
  const status = useSessionStore((s) => s.authStatus);
  const location = useLocation();
  if (status === "loading")
    return (
      <p className="p-8 text-muted" role="status">
        Verifying your workspace access…
      </p>
    );
  if (status === "counter-locked") return <Navigate to="/counter" replace />;
  if (status !== "authenticated")
    return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;
  return <Outlet />;
}
export function PermissionGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { profile, permissions } = useSessionStore();
  if (!canOpenRoute(pathname, profile, permissions))
    return (
      <section className="panel access-denied">
        <ShieldX size={32} />
        <h1>Access Denied</h1>
        <p>
          Your account does not have permission to open this module. Contact the
          owner to request access.
        </p>
        <Link
          className="button button-primary"
          to={homeRoute(profile, permissions)}
        >
          Return to workspace
        </Link>
      </section>
    );
  if (
    (!localDemoEnabled &&
      ![
        "dashboard",
        "pos",
        "products",
        "stock",
        "low-stock",
        "inventory",
        "locations",
        "stock-receiving",
        "transfers",
        "employees",
        "suppliers",
        "audit-log",
        "profile",
        "repair-jobs","shifts","customers","transactions","sale-complete","returns","credit","out-for-test","services","buy-device","purchased-devices","coupons","payments","payment-methods","settings","reports",
      ].includes(pathname.split("/")[1])) ||
    (!localDemoEnabled && pathname === "/products/import")
  )
    return (
      <section className="panel empty-state">
        <h1>Backend connection pending</h1>
        <p>
          Shared transactions, catalog and stock are connected through the shop backend. This
          workflow is available in Local Demo mode until its server transactions
          are migrated.
        </p>
        <Link className="button button-primary" to="/products">
          Open Products
        </Link>
      </section>
    );
  return children;
}
export function HomeRedirect() {
  const { profile, permissions } = useSessionStore();
  return <Navigate to={homeRoute(profile, permissions)} replace />;
}
