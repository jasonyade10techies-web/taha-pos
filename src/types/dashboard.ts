export interface DashboardMetric {
  label: string;
  value: number | null;
  change: number | null;
  detail: string;
  icon: "sales" | "cash" | "digital" | "credit" | "profit" | "stock";
}
export interface DashboardData {
  metrics: DashboardMetric[];
  chart: { day: string; date?:string; sales: number; profit: number | null }[];
  activity: {
    href?:string;
    id: number;
    type: string;
    text: string;
    amount: number | null;
    time: string;
  }[];
  lowStock: {
    id?:string;
    name: string;
    code: string;
    current: number;
    minimum: number;
    location: string;
  }[];
  credit: {
    id?:string;
    taken?:string;
    name: string;
    initials: string;
    amount: number;
    due: string;
    overdue: boolean;
  }[];
}
