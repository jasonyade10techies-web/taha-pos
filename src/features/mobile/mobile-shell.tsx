import { Outlet, Link, useNavigate } from "react-router-dom";
import { Menu, Bell, ChevronDown } from "lucide-react";
import { Logo } from "../../components/ui/logo";
import { MobileNavigation } from "../../components/layout/mobile-navigation";
import { useSessionStore } from "../../stores/session-store";
import { useShopConnectionStore } from "../../stores/shop-connection-store";
import { useMobileKeyboard } from "../../hooks/use-mobile-keyboard";
import { MediaImage } from "../../components/media/media-image";
import { Dropdown, DropdownItem } from "../../components/ui/dropdown";
import {useInventoryRealtime} from '../../hooks/use-inventory-realtime';
import {bundledMobile} from '../../lib/mobile/runtime';
import {useMobilePreferences} from '../../stores/mobile-preferences-store';
import {useEffect,useState} from 'react';
import {useCloudSyncStore} from '../../stores/cloud-sync-store';
import {apiEnabled} from '../../lib/config';
import {ShopSetupGate} from '../settings/first-run-setup';
export function MobileShell() {
  useInventoryRealtime();
  useMobileKeyboard();
  const verified=useMobilePreferences(s=>s.verifiedSession);
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  const navigate = useNavigate(),
    session = useSessionStore(),
    connection = useShopConnectionStore();
  const cloud=useCloudSyncStore();
  const connected = bundledMobile ? connection.connectionStatus === "connected" : online && verified && (!apiEnabled||cloud.status==='connected');
  const connectionLabel=connected?'Connected':!online?'Offline':apiEnabled&&cloud.status==='connecting'?'Connecting…':apiEnabled&&cloud.status==='reconnecting'?'Reconnecting…':'Offline';
  return (
    <div className="staff-app">
      <header className="staff-app-header">
        <button
          aria-label="Open navigation"
          onClick={() =>
            window.dispatchEvent(new Event("taha-open-mobile-menu"))
          }
        >
          <Menu size={22} />
        </button>
        <div className="staff-header-brand">
          <Logo />
          <span>{session.context?.store?.branch_name || "Main Branch"}</span>
        </div>
        <Dropdown
          trigger={
            <button
              className={`staff-network ${connected ? "online" : "offline"}`}
              aria-label="Connection status"
            >
              <i />
              {connectionLabel}
              <ChevronDown size={12} />
            </button>
          }
        >
          <DropdownItem onSelect={() => bundledMobile ? void connection.check() : window.dispatchEvent(new Event('taha-app-resume'))}>
            Retry Connection
          </DropdownItem>
          {bundledMobile && <DropdownItem onSelect={() => navigate("/mobile/shop-connection")}>
            Shop Connection
          </DropdownItem>}
        </Dropdown>
        <Link
          className="staff-header-alert"
          aria-label="Activity"
          to="/mobile/activity?tab=alerts"
        >
          <Bell size={20} />
        </Link>
        <Link
          className="staff-header-avatar"
          to="/profile"
          aria-label="Your profile"
        >
          {session.profile?.avatar_url ? (
            <MediaImage
              src={
                session.profile.avatar_url.includes("/") &&
                !session.profile.avatar_url.startsWith("http")
                  ? `taha-media:${session.profile.avatar_url}`
                  : session.profile.avatar_url
              }
              alt=""
            />
          ) : (
            session.employee.initials
          )}
        </Link>
      </header>
      <main className="staff-app-content">
        <ShopSetupGate><Outlet /></ShopSetupGate>
      </main>
      <MobileNavigation />
    </div>
  );
}
