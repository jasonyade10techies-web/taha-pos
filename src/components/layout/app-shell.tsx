import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { OfflineBanner } from "./network-status";
import { CommandMenu } from "../navigation/command-menu";
import { useShortcuts } from "../../hooks/use-shortcuts";
import { useCustomerDisplayPublisher } from "../../hooks/use-customer-display";
import { apiEnabled, mockAuthEnabled } from "../../lib/config";
import { MobileNavigation } from "./mobile-navigation";
import { useInventoryRealtime } from "../../hooks/use-inventory-realtime";
import { useSessionStore } from "../../stores/session-store";
import { VirtualKeyboardHost } from "../ui/virtual-keyboard";

export function AppShell() {
  useShortcuts();
  useInventoryRealtime();
  const branch = useSessionStore((s) => s.context?.store?.branch_name);
  useCustomerDisplayPublisher();
  const location = useLocation();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-workspace">
        <Header />
        <OfflineBanner />
        {import.meta.env.DEV&&import.meta.env.VITE_LOCAL_ACCEPTANCE==='true'&&<div className="local-testing-banner" role="status">Local Test Data <span>Shared shop backend · Saved in this PC’s development database</span></div>}
        <main className="main-content" id="main-content">
          <motion.div
            className="page-content"
            key={location.pathname}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.17 }}
          >
            <Outlet />
          </motion.div>
        </main>
        <div className="workspace-footer">
          <span>
            TAHA MOBILES <i /> {branch}
          </span>
          <span>
            {mockAuthEnabled
              ? "Demo Data · Saved on this device"
              : apiEnabled ? "Shared transactions, catalog and stock" : "Shared transactions, catalog and stock"}
          </span>
        </div>
      </div>
      <CommandMenu />
      <MobileNavigation />
      <VirtualKeyboardHost />
    </div>
  );
}
