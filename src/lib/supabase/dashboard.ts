import {creditReminderDetails} from "../dashboard-actions";



import {apiEnabled} from "../config";

import {read} from "../api/catalog-repositories";

import {activeStore,allowed,rpc} from "./repository-utils";

import {repositories} from "../repositories";

import type {DashboardData,DashboardMetric} from "../../types/dashboard";

import type {DateRange} from '../dashboard-range';

export async function remoteDashboard(range?:DateRange):Promise<DashboardData> {

  const legacy = () => rpc("get_dashboard_transactions",{p_store_id:activeStore()});

  const base=apiEnabled ? await read<Awaited<ReturnType<typeof legacy>>>("/dashboard") : await legacy();

  const data=apiEnabled&&range?{...base,...await read<Pick<typeof base,'summary'|'profit'|'chart'>>(`/dashboard/range?from=${range.from}&to=${range.to}`)}:base;

  const products=allowed("inventory.view")?await repositories.products.pos():[];

  const low=products.filter(p=>p.category!=="Services" && p.quantity<=p.lowStockLevel);

  const summary=data.summary;

  const creditAccess=allowed('credit.create')||allowed('credit.receive_payment');

  const obligations=creditAccess?await repositories.customers.reminders?.()??[]:[];

  const credit=data.credit.map(c=>creditReminderDetails(c,obligations));

  const values:[string,DashboardMetric["icon"],number|null,string][]=[

    [range&&range.label!=="Today"?"Sales":"Today's Sales","sales",summary?summary.sales-summary.returns:null,"Net sales today"],

    ["Cash Collected","cash",summary?.cash ?? null,"Sales and old debt collections"],

    ["Digital Payments","digital",summary?.digital ?? null,"Confirmed electronic payments"],

    ["Credit Given","credit",summary?.creditGiven ?? null,"Credit extended today"],

    ["Gross Profit","profit",data.profit,"After returns and restored stock cost"],

    ["Low Stock","stock",allowed("inventory.view")?low.length:null,"Products at or below reorder level"],

  ];

  return {metrics:values.map(([label,icon,value,detail])=>({label,icon,value,detail:value===null?(icon==="profit" && allowed("profit.view")?"Acquisition cost snapshots are incomplete":"Restricted"):detail,change:null})),chart:data.chart,activity:data.activity,credit,

    lowStock:low.slice(0,5).map(p=>({id:p.id,name:p.name,code:p.internalCode,current:p.quantity,minimum:p.lowStockLevel,location:p.location?`Rack ${p.location.rack} → ${p.location.shelf} → ${p.location.box}`:"Unassigned"}))};

}

