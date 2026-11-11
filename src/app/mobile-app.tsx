import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, BrowserRouter } from "react-router-dom";
import { bundledMobile } from "../lib/mobile/runtime";
const Router = bundledMobile ? HashRouter : BrowserRouter;
import { MotionConfig } from "framer-motion";
import { MobileAuthProvider } from "../features/mobile/mobile-auth-provider";
import { MobileRoutes } from "../features/mobile/mobile-routes";
import { DeviceBridgeProvider } from "../components/devices/device-bridge-provider";
import { ToastHost } from "../components/ui/feedback";
import { useTheme } from "../hooks/use-theme";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30000 } },
});
export function MobileApp() {
  useTheme();
  return (
    <QueryClientProvider client={client}>
      <MobileAuthProvider>
        <MotionConfig reducedMotion="user">
          <Router>
            <DeviceBridgeProvider>
              <MobileRoutes />
              <ToastHost />
            </DeviceBridgeProvider>
          </Router>
        </MotionConfig>
      </MobileAuthProvider>
    </QueryClientProvider>
  );
}
