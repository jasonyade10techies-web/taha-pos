import { useQuery } from "@tanstack/react-query";
import { staffService } from "../../lib/mobile/staff-service";
import { currency } from "../../lib/utils";
export function MobileReportsPage() {
  const query = useQuery({
      queryKey: ["staff-report-summary"],
      queryFn: staffService.dashboard,
    }),
    data = query.data?.data;
  return (
    <div className="staff-page">
      <div className="staff-page-heading">
        <span className="eyebrow">TODAY'S SUMMARY</span>
        <h1>Reports</h1>
        <p>Compact totals for your permitted shop activity.</p>
      </div>
      {query.isError && <p role="alert">{query.error.message}</p>}
      <div className="staff-metric-grid">
        {Object.entries(data?.summary || {}).map(([key, value]) => (
          <article className="panel" key={key}>
            <span>{key.replace(/([A-Z])/g, " $1")}</span>
            <strong>{currency(Number(value))}</strong>
          </article>
        ))}
      </div>
      {staffService.allow("profit.view") && (
        <article className="panel staff-report-profit">
          <span>Gross Profit</span>
          <strong>
            {query.data?.cached
              ? "Connect to refresh"
              : data?.profit === null || data?.profit === undefined
                ? "—"
                : currency(data.profit)}
          </strong>
        </article>
      )}
      <p className="staff-cache-label">
        {query.data?.cached
          ? "Saved snapshot"
          : "Detailed report tables are available at the counter."}
      </p>
    </div>
  );
}
