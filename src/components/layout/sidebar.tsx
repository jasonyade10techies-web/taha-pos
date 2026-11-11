import { motion, useReducedMotion } from "framer-motion";
import { NavLink } from "react-router-dom";
import {
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  ChevronsUpDown,
} from "lucide-react";
import { useUiStore } from "../../stores/ui-store";
import { useSessionStore } from "../../stores/session-store";
import {
  navigation,
  dashboardNav,
  type NavItem,
} from "../navigation/navigation-data";
import { Logo } from "../ui/logo";
import { NetworkStatus } from "./network-status";
import { canOpenRoute } from "../../features/auth/route-access";
import { useShopConfiguration } from "../../hooks/use-shop-configuration";
import { visibleShopRoute } from "../../types/shop-configuration";

function NavigationLink({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      title={item.label}
      className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
      aria-label={item.label}
    >
      <Icon size={18} strokeWidth={1.7} />
      <span className="nav-label">{item.label}</span>
      {item.path === "/pos" && !collapsed && (
        <kbd className="nav-label">F1</kbd>
      )}
    </NavLink>
  );
}
export function Sidebar() {
  const {configuration}=useShopConfiguration();
  const reducedMotion = useReducedMotion();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const branch = useUiStore((s) => s.branch);
  const employee = useSessionStore((s) => s.employee);
  const profile = useSessionStore(s => s.profile), permissions = useSessionStore(s => s.permissions);
  const groups = navigation.map(group => ({ ...group, items: group.items.filter(item => canOpenRoute(item.path, profile, permissions)&&visibleShopRoute(item.path,configuration)) })).filter(group => group.items.length);
  return (
    <motion.aside
      className={`sidebar ${collapsed ? "is-collapsed" : ""}`}
      animate={{ width: collapsed ? 72 : 230 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      aria-label="Main navigation"
    >
      <div className="sidebar-brand">
        <Logo compact={collapsed} dark />
      </div>
      <nav className="sidebar-navigation">
        {canOpenRoute(dashboardNav.path, profile, permissions) && <NavigationLink item={dashboardNav} collapsed={collapsed} />}
        {groups.map((group) => (
          <div className="nav-group" key={group.title}>
            <div className="nav-group-title">{group.title}</div>
            {group.items.map((item) => (
              <NavigationLink
                key={item.path}
                item={item}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-branch">
          <Store size={17} />
          <div className="nav-label">
            <strong>Taha Mobiles</strong>
            <span>{branch.name}</span>
          </div>
          <NetworkStatus sidebar />
        </div>
        <NavLink
          to="/profile"
          className="sidebar-user"
          aria-label={`${employee.name} profile`}
        >
          <span className="avatar sidebar-avatar">{employee.initials}</span>
          <div className="nav-label">
            <strong>{employee.name}</strong>
            <span>{employee.role}</span>
          </div>
          <ChevronsUpDown className="nav-label" size={14} />
        </NavLink>
      </div>
      <button
        className="sidebar-collapse"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen size={17} />
        ) : (
          <>
            <PanelLeftClose size={17} />
            <span className="nav-label">Collapse sidebar</span>
            <ChevronLeft className="nav-label ml-auto" size={14} />
          </>
        )}
      </button>
    </motion.aside>
  );
}
