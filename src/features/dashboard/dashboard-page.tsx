import {AndroidDownloads} from "../../components/devices/android-downloads";
import {dashboardDestination} from "../../lib/dashboard-actions";
import "./dashboard-actions.css";
import { useQuery } from "@tanstack/react-query";
import { Link,useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { retailDataSource, queryKeys } from "../../lib/data-source";
import { PageHeading } from "../../components/ui/page-heading";
import {useState} from 'react';
import {DateRangeControl} from '../../components/dashboard/date-range-control';
import {presetRange} from '../../lib/dashboard-range';
import { KpiCard } from "../../components/dashboard/kpi-card";
import { SalesChart } from "../../components/dashboard/sales-chart";
import { RecentActivity } from "../../components/dashboard/recent-activity";
import { LowStockTable } from "../../components/dashboard/low-stock-table";
import { CreditReminders } from "../../components/dashboard/credit-reminders";
import { useSessionStore } from "../../stores/session-store";
import { mockAuthEnabled } from "../../lib/config";
import {CashExceptionsNotice} from '../../components/layout/cash-exceptions-notice';

export function DashboardPage() {
  const context = useSessionStore((s) => s.context);
  const [params,setParams]=useSearchParams();
  const [range,setRange]=useState(()=>params.get('from')&&params.get('to')?{from:params.get('from')!,to:params.get('to')!,label:params.get('range')??'Custom Range'}:presetRange('Today'));
  const { data, isError } = useQuery({
    queryKey: [...queryKeys.dashboard(
      context?.profile?.id ?? "",
      context?.store?.id ?? "",
    ),range.from,range.to],
    queryFn: ()=>retailDataSource.dashboard(range),
  });
  if (!data)
    return (
      <p role="status" className="p-8 text-muted">
        {isError ? "Unable to load the dashboard." : "Loading your workspace…"}
      </p>
    );
  return (
    <div className="dashboard-page">
      <PageHeading
        title="Dashboard"
        subtitle={range.label==='Today'?'Overview of today’s activity at Taha Mobiles.':'Overview of the selected period at Taha Mobiles.'}
        action={
          <>
            <DateRangeControl value={range} onChange={value=>{setRange(value);setParams({from:value.from,to:value.to,range:value.label},{replace:true});}}/>
            <Link className="button button-primary" to="/pos">
              <Plus size={18} />
              New Sale
            </Link>
          </>
        }
      />
      <div className="dashboard-context">
        <span className="live-dot" />
        {context?.store?.branch_name ?? "Main Branch"}{" "}
        <span className="context-separator">/</span>
        <span>
          {range.label!=='Today'?`${range.from} → ${range.to}`:new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </span>
        <span className="ml-auto text-xs">
          {mockAuthEnabled
            ? `${range.label==='Today'?'Today’s snapshot':'Period snapshot'} · Demo`
            : "Live shop totals · Updated automatically"}
        </span>
      </div>
      <div className="kpi-grid">
        {data.metrics.map((metric) => (
          <KpiCard key={metric.label} href={dashboardDestination(metric.icon,range)} metric={range.label==='Today'?metric:{...metric,detail:metric.detail.replace(/today/gi,'in this period')}} />
        ))}
      </div>
      <CashExceptionsNotice/>
      <AndroidDownloads compact/>
      <div className="dashboard-grid">
        <SalesChart data={data.chart} period={range.label}/>
        <RecentActivity data={data.activity} />
      </div>
      <div className="dashboard-grid dashboard-bottom">
        <LowStockTable data={data.lowStock} count={data.metrics[5].value} />
        <CreditReminders data={data.credit} />
      </div>
    </div>
  );
}
