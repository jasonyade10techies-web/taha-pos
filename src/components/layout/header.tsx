import {useToasts} from '../../stores/toast-store';
import {MediaImage} from '../media/media-image';
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Store,
  Settings2,
  Check,
  ChevronRight,
  UserRound,
  LogOut,
  Users,
  KeyRound,
  Smartphone,
  Menu,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { mockAuthEnabled } from "../../lib/config";
import { lockCounter, signOut } from "../../features/auth/session-actions";
import { useUiStore } from "../../stores/ui-store";
import { useSessionStore } from "../../stores/session-store";
import { pageContext } from "../navigation/navigation-data";
import { Button } from "../ui/button";
import { Dropdown, DropdownItem, DropdownSeparator } from "../ui/dropdown";
import type { ThemePreference } from "../../types/session";
import { useRepository } from "../../hooks/use-repository";
import { repositories } from "../../lib/repositories";
import { localDemoEnabled } from "../../lib/config";
import { ConfirmDialog } from "../ui/workspace";
import { StaffPhoneStatus } from "../devices/staff-phone-status";
import {SyncStatus} from './sync-status';
import {usePermission} from '../../hooks/use-permission';
import {useShopClock} from '../../hooks/use-shop-clock';
import { canOpenRoute } from "../../features/auth/route-access";
import {useShopConfiguration} from '../../hooks/use-shop-configuration';

export function Header() {
  const {ownerOnly}=useShopConfiguration();
  const now=useShopClock(),creditRead=usePermission('credit.create'),creditCollect=usePermission('credit.receive_payment'),testRead=usePermission('inventory.transfer');
  const dueAlerts=useRepository('due-alerts-'+Math.floor(now/60000),()=>repositories.customers.reminderAlerts?.()??Promise.resolve([]),creditRead||creditCollect||testRead);
  const history = useToasts(state=>state.history);
  const { pathname } = useLocation();
  const context = pageContext(pathname);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const terminal = useSessionStore((s) => s.terminal);
  const [sessionError, setSessionError] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const branch = useUiStore((s) => s.branch);
  const employee = useSessionStore((s) => s.employee);
  const profile = useSessionStore((s) => s.profile);
  const permissions = useSessionStore(s => s.permissions);
  const canOpen = (path: string) => canOpenRoute(path, profile, permissions);
  const setCommandOpen = useSessionStore((s) => s.setCommandOpen);
  const [unread, setUnread] = useState(true);
  const alerts = useRepository("header-alerts", async () => {
    if (!localDemoEnabled) {
      const current = useSessionStore.getState();
      if (
        current.profile?.role !== "owner" &&
        !current.permissions.some((p) =>
          [
            "inventory.view",
            "sales.create",
            "products.create",
            "products.edit",
            "inventory.receive",
            "inventory.transfer",
            "inventory.adjust",
          ].includes(p),
        )
      )
        return { enabled: false, low: 0, credit: 0, overdue: 0 };
      const products = await repositories.products.pos();
      return {
        enabled: true,
        low: products.filter((p) => p.quantity <= p.lowStockLevel).length,
        credit: 0,
        overdue: 0,
      };
    }
    const settings = await repositories.settings.get();
    const products = await repositories.products.pos();
    const ledger = await repositories.credit.ledger();
    const tests = await repositories.credit.tests();
    return {
      enabled: settings.notifications,
      low: settings.lowStockAlerts
        ? products.filter(
            (p) => p.category !== "Services" && p.quantity <= p.lowStockLevel,
          ).length
        : 0,
      credit: new Set(
        ledger.filter((l) => l.debit > 0).map((l) => l.customerId),
      ).size,
      overdue: tests.filter(
        (t) =>
          t.status === "OUT" &&
          t.dueDate < new Date().toLocaleDateString("en-CA"),
      ).length,
    };
  });
  const notifications = alerts.data;
  return (
    <header className="top-header">
      <button className="mobile-header-menu" aria-label="Open navigation" onClick={()=>window.dispatchEvent(new Event("taha-open-mobile-menu"))}><Menu size={22}/></button>
      <div className="breadcrumb">
        <span>{context.group}</span>
        <ChevronRight size={14} />
        <strong>{context.item?.label ?? (pathname === "/profile" ? "Your Profile" : "Workspace")}</strong>
      </div>
      <div className="header-actions">
        <SyncStatus/>
        <StaffPhoneStatus/>
        <button
          className="global-search"
          onClick={() => setCommandOpen(true)}
          aria-label="Open global search"
        >
          <Search size={17} />
          <span>Search anything...</span>
          <kbd>Ctrl K</kbd>
        </button>
        <Dropdown
          label="Notifications"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="relative"
            >
              <Bell size={20} />
              {unread && notifications?.enabled !== false && (
                <span className="notification-count">
                  {(localDemoEnabled ? 3 : (notifications?.low ?? 0))+(dueAlerts.data?.length??0)}
                </span>
              )}
            </Button>
          }
        >
          <div className="max-h-[70dvh] overflow-y-auto">
          <div className="px-3 py-2 font-semibold">
            Notifications{" "}
            <span className="text-xs text-muted">
              · {localDemoEnabled ? "Demo" : "Inventory"}
            </span>
          </div>
          <DropdownSeparator />
          {dueAlerts.data?.filter(alert=>canOpen(alert.kind==='credit'?'/credit/'+alert.customerId:'/out-for-test')).slice(0,8).map(alert=><DropdownItem key={alert.id} onSelect={()=>navigate(alert.kind==='credit'?'/credit/'+alert.customerId:'/out-for-test')}><span className="notification-dot amber"/><div><strong>{alert.title}</strong><small>{alert.description}</small></div></DropdownItem>)}
          {history.slice(0,5).map(item=><div className="notification-entry" key={item.id}><div><strong>{item.message}</strong><small>{item.createdAt?new Date(item.createdAt).toLocaleTimeString("en-PK"):"Just now"}</small></div></div>)}
          {notifications?.enabled === false ? (
            <p className="notification-entry">
              Notifications are disabled in Settings.
            </p>
          ) : (
            <>
              {canOpen("/low-stock") && <DropdownItem onSelect={() => navigate("/low-stock")}>
                <span className="notification-dot" />
                <div>
                  <strong>
                    {notifications?.low ?? 0} products are running low
                  </strong>
                  <small>Review your replenishment list.</small>
                </div>
              </DropdownItem>}
              {localDemoEnabled && canOpen("/credit") && (
                <DropdownItem onSelect={() => navigate("/credit")}>
                  <span className="notification-dot amber" />
                  <div>
                    <strong>Review credit accounts</strong>
                    <small>
                      {notifications?.credit ?? 0} accounts with credit
                      activity.
                    </small>
                  </div>
                </DropdownItem>
              )}
              {localDemoEnabled && canOpen("/out-for-test") && (
                <DropdownItem onSelect={() => navigate("/out-for-test")}>
                  <span className="notification-dot green" />
                  <div>
                    <strong>
                      {notifications?.overdue ?? 0} overdue test records
                    </strong>
                    <small>Review items with customers.</small>
                  </div>
                </DropdownItem>
              )}
            </>
          )}
          <DropdownSeparator />
          <DropdownItem onSelect={() => setUnread(false)}>
            <Check size={16} />
            Mark all as read
          </DropdownItem>
          </div>
        </Dropdown>
        <Dropdown
          label="Theme"
          trigger={
            <Button variant="ghost" size="icon" aria-label="Choose theme">
              {theme === "dark" ? (
                <Moon size={19} />
              ) : theme === "system" ? (
                <Monitor size={19} />
              ) : (
                <Sun size={19} />
              )}
            </Button>
          }
        >
          <div className="dropdown-label">Appearance</div>
          {(
            [
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <DropdownItem
              key={value}
              onSelect={() => setTheme(value as ThemePreference)}
            >
              <Icon size={17} />
              {label}
              {theme === value && <Check size={15} className="ml-auto" />}
            </DropdownItem>
          ))}
        </Dropdown>
        <div className="header-divider" />
        <Dropdown
          label="Branch selector"
          trigger={
            <Button
              variant="ghost"
              className="branch-selector"
              aria-label="Select branch"
            >
              <Store size={16} />
              <span>{branch.name}</span>
              <ChevronDown size={14} />
            </Button>
          }
        >
          <div className="dropdown-label">Your branch</div>
          <DropdownItem>
            <Store size={16} />
            {branch.name}
            <Check size={15} className="ml-auto" />
          </DropdownItem>
          <p className="px-3 py-2 text-xs text-muted">
            Additional branches arrive in a later phase.
          </p>
        </Dropdown>
        <Dropdown
          label="Profile"
          trigger={
            <button
              className="avatar header-avatar"
              aria-label="Open profile menu"
            >
              {profile?.avatar_url ? (
                <MediaImage
                  src={profile.avatar_url}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                employee.initials
              )}
            </button>
          }
        >
          <div className="px-3 py-2">
            <strong className="block text-sm">{employee.name}</strong>
            <span className="text-xs text-muted">{employee.role}</span>
          </div>
          <DropdownSeparator />
          <DropdownItem onSelect={() => navigate("/profile")}>
            <UserRound size={17} />
            Profile
          </DropdownItem>
          <DropdownItem disabled={localDemoEnabled || terminal} onSelect={() => navigate("/profile#password")}>
            <KeyRound size={17} />
            Change password
          </DropdownItem>
          <DropdownItem onSelect={() => navigate("/profile#devices")}>
            <Smartphone size={17} />
            Connected devices
          </DropdownItem>
          <DropdownItem
            onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun size={17} />
            Theme · {theme}
          </DropdownItem>
          {canOpen("/settings") && <DropdownItem onSelect={() => navigate("/settings")}>
            <Settings2 size={17} />
            Workspace settings
          </DropdownItem>}
          <DropdownItem onSelect={() => navigate("/mobile-camera")}>
            <Smartphone size={17} />
            Camera requests
          </DropdownItem>
          {!ownerOnly && (terminal || mockAuthEnabled) && (
            <DropdownItem
              onSelect={() => {
                if (mockAuthEnabled) navigate("/counter");
                else
                  void lockCounter(queryClient).catch(() =>
                    setSessionError(
                      "Counter locked locally. Server revocation could not be confirmed.",
                    ),
                  );
              }}
            >
              <Users size={17} />
              Switch employee
            </DropdownItem>
          )}
          <DropdownSeparator />
          <DropdownItem
            onSelect={() => {
              setLogoutOpen(true);
            }}
          >
            <LogOut size={17} />
            Sign Out
          </DropdownItem>
          {sessionError && (
            <p className="px-3 py-2 text-xs text-danger" role="alert">
              {sessionError}
            </p>
          )}
        </Dropdown>
      </div>
      <ConfirmDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} onConfirm={() => void signOut(queryClient).catch(() => setSessionError("Your local session was cleared."))} title="Sign out of account?" description={ownerOnly?"Your account will sign out and the current counter sale will be cleared.":"Your current counter sale will be cleared. Use Switch Employee to change the cashier without signing out of the account."} confirm="Sign Out"/>
    </header>
  );
}
