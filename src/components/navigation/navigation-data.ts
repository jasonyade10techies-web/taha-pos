import {
  LayoutDashboard,
  ShoppingBag,
  ReceiptText,
  RotateCcw,
  Package,
  Boxes,
  MapPin,
  PackagePlus,
  ArrowLeftRight,
  PackageSearch,
  Wrench,
  ClipboardList,
  WalletCards,
  FlaskConical,
  Smartphone,
  ShoppingBasket,
  Truck,
  Users,
  Clock3,
  TicketPercent,
  CreditCard,
  ChartNoAxesCombined,
  History,
  Globe,
  MessageSquare,
  Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}
export const dashboardNav: NavItem = {
  label: "Dashboard",
  path: "/dashboard",
  icon: LayoutDashboard,
  description: "A clear overview of sales, stock, and shop activity.",
};
export const navigation: NavGroup[] = [
  {
    title: "Sales",
    items: [
      {
        label: "New Sale",
        path: "/pos",
        icon: ShoppingBag,
        description: "Search products and build a sale.",
      },
      {
        label: "Transactions",
        path: "/transactions",
        icon: ReceiptText,
        description: "Sales history, receipts, and payment details.",
      },
      {
        label: "Returns",
        path: "/returns",
        icon: RotateCcw,
        description: "Manage customer returns and refunds.",
      },
    ],
  },
  { title: "Customers", items: [{ label: "Customers", path: "/customers", icon: Users, description: "Search customers, shop contacts, and customer history." }] },
  {
    title: "Inventory",
    items: [
      {
        label: "Products",
        path: "/products",
        icon: Package,
        description:
          "Your complete catalog of parts, accessories, and devices.",
      },
      {
        label: "Stock",
        path: "/stock",
        icon: Boxes,
        description: "Track available stock and inventory movements.",
      },
      {
        label: "Locations",
        path: "/locations",
        icon: MapPin,
        description: "Organize products by rack, shelf, and box.",
      },
      {
        label: "Stock Receiving",
        path: "/stock-receiving",
        icon: PackagePlus,
        description: "Receive and verify incoming inventory.",
      },
      {
        label: "Transfers",
        path: "/transfers",
        icon: ArrowLeftRight,
        description: "Move stock between locations with a clear history.",
      },
      {
        label: "Low Stock",
        path: "/low-stock",
        icon: PackageSearch,
        description: "Identify products that need replenishment.",
      },
    ],
  },
  {
    title: "Services",
    items: [
      {
        label: "Repair Services",
        path: "/services",
        icon: Wrench,
        description: "Define services, pricing, and repair options.",
      },
      {
        label: "Repair Jobs",
        path: "/repair-jobs",
        icon: ClipboardList,
        description: "Track repairs from intake to delivery.",
      },
    ],
  },
  {
    title: "Credit",
    items: [
      {
        label: "Credit Accounts",
        path: "/credit",
        icon: WalletCards,
        description: "Track balances and collections for customers and shops.",
      },
      {
        label: "Out for Test",
        path: "/out-for-test",
        icon: FlaskConical,
        description: "Keep track of items sent out for testing.",
      },
    ],
  },
  {
    title: "Purchasing",
    items: [
      {
        label: "Buy Device",
        path: "/buy-device",
        icon: Smartphone,
        description: "Record used-device purchases and inspection details.",
      },
      {
        label: "Purchased Devices",
        path: "/purchased-devices",
        icon: ShoppingBasket,
        description: "Review purchased phones and their preparation status.",
      },
      {
        label: "Suppliers",
        path: "/suppliers",
        icon: Truck,
        description: "Manage supplier contacts and purchasing history.",
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        label: "Employees",
        path: "/employees",
        icon: Users,
        description: "Manage employees, roles, and access.",
      },
      {
        label: "Shifts",
        path: "/shifts",
        icon: Clock3,
        description: "Track shifts and opening and closing cash.",
      },
      {
        label: "Coupons",
        path: "/coupons",
        icon: TicketPercent,
        description: "Manage promotions and coupon rules.",
      },
      {
        label: "Payments",
        path: "/payments",
        icon: CreditCard,
        description: "Review cash, digital payments, and collections.",
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        label: "Reports",
        path: "/reports",
        icon: ChartNoAxesCombined,
        description: "Understand sales, inventory, and business performance.",
      },
      {
        label: "Audit Log",
        path: "/audit-log",
        icon: History,
        description: "Review important actions and changes.",
      },
    ],
  },
  {
    title: "Website",
    items: [
      {
        label: "Website Products",
        path: "/website-products",
        icon: Globe,
        description: "Manage products published to your future website.",
      },
      {
        label: "Repair Enquiries",
        path: "/repair-enquiries",
        icon: MessageSquare,
        description: "Review enquiries from website visitors.",
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        label: "Settings",
        path: "/settings",
        icon: Settings2,
        description: "Customize your workspace and preferences.",
      },
    ],
  },
];
export const allNavigation = [
  dashboardNav,
  ...navigation.flatMap((g) => g.items),
];
export function pageContext(pathname: string) {
  const root = "/" + pathname.split("/")[1];
  const item = allNavigation.find((item) => item.path === root);
  const group = navigation.find((group) =>
    group.items.some((item) => item.path === root),
  );
  return { item, group: group?.title ?? "Workspace" };
}
