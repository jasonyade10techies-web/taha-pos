import "./lib/uuid";
import {nativeDesktop} from './lib/desktop/runtime';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "./styles/globals.css";
import "./styles/auth.css";
import "./styles/management.css";
import "./styles/counter.css";
import "./styles/mobile.css";
import "./styles/shop-connection.css";
import "./styles/device-bridge.css";
import './styles/desktop.css';
import {MobileRoot} from "./features/mobile/shop-connection";
import {bundledMobile} from "./lib/mobile/runtime";
import {ErrorBoundary} from "./app/error-boundary";
import { App } from "./app/app";
import { useUiStore } from "./stores/ui-store";
import {DeploymentIndicator} from './components/layout/deployment-indicator';
import './styles/staging.css';

const theme = useUiStore.getState().theme;
const dark =
  theme === "dark" ||
  (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark", dark);
document.documentElement.style.colorScheme = dark ? "dark" : "light";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary><MobileRoot><DeploymentIndicator/><App /></MobileRoot></ErrorBoundary>
  </StrictMode>,
);

requestAnimationFrame(()=>{window.__tahaUiReady=true;});
if (!nativeDesktop && !bundledMobile && import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
import './styles/staff.css';

import './styles/product-hardening.css';

import './styles/receipt-print.css';
import './styles/invoice-print.css';
