import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ScanLine,
  Camera,
  Boxes,
  Monitor,
  ArrowUpRight,
  Activity,
  PackagePlus,
} from "lucide-react";
import { staffService, mobileRead } from "../../lib/mobile/staff-service";
import { useSessionStore } from "../../stores/session-store";
import { currency } from "../../lib/utils";
import { useCameraStore } from "../../stores/camera-store";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
export function MobileHomePage() {
  const session = useSessionStore(),
    financial =
      staffService.allow("sales.view") && session.profile?.role !== "employee";
  const query = useQuery({
    queryKey: ["staff-home", session.profile?.id],
    queryFn: staffService.dashboard,
    enabled: financial,
  });
  const data = query.data?.data,
    summary = data?.summary;
  const bridge = useDeviceBridgeStore(),
    stock = useQuery({
      queryKey: ["staff-products"],
      queryFn: staffService.products,
      enabled: staffService.allow("inventory.view"),
    });
  const shift = useQuery({
    queryKey: ["staff-my-shift", session.profile?.id],
    queryFn: () =>
      mobileRead<{
        status: string;
        scheduledStart: string;
        actualStart: string;
      } | null>("/mobile/my-shift"),
    enabled: session.profile?.role === "employee",
  });
  const requests = useCameraStore(
    (s) =>
      s.jobs.filter(
        (j) => !["received", "cancelled", "expired"].includes(j.status),
      ).length,
  );
  const cards = [
    { name: "Sales", value: summary ? summary.sales - summary.returns : null },
    { name: "Cash", value: summary?.cash ?? null },
    { name: "Credit", value: summary?.creditGiven ?? null },
    ...(staffService.allow("profit.view")
      ? [
          {
            name: "Profit",
            value: query.data?.cached ? null : (data?.profit ?? null),
          },
        ]
      : []),
  ];
  return (
    <div className="staff-page">
      <div className="staff-page-heading">
        <span className="eyebrow">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "short",
          })}
        </span>
        <h1>Hello, {session.profile?.full_name.split(" ")[0] || "there"}</h1>
        <p>Your shop, at a glance.</p>
      </div>
      {financial && (
        <>
          <div className="staff-metric-grid">
            {cards.map((card) => (
              <article className="panel" key={card.name}>
                <span>{card.name}</span>
                <strong>
                  {card.value === null ? "—" : currency(Number(card.value))}
                </strong>
              </article>
            ))}
          </div>
          {query.data?.cached && (
            <p className="staff-cache-label">
              Saved snapshot · Reconnect for current totals
            </p>
          )}
          {query.isError && (
            <p className="staff-cache-label">
              Connect to the shop to refresh today's summary.
            </p>
          )}
        </>
      )}
      {financial && !!data?.chart.length && (
        <section className="panel staff-mini-chart">
          <div className="staff-section-heading">
            <h2>Sales this week</h2>
            <span className="text-xs text-muted">7 days</span>
          </div>
          <svg
            className="staff-sparkline"
            viewBox="0 0 340 72"
            role="img"
            aria-label="Weekly sales trend"
          >
            <polyline
              points={data.chart
                .map(
                  (p, i) =>
                    `${12 + (i * 316) / Math.max(1, data.chart.length - 1)},${60 - (p.sales / Math.max(1, ...data.chart.map((p) => p.sales))) * 48}`,
                )
                .join(" ")}
              fill="none"
              stroke="var(--chart-sales)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
        </section>
      )}
      <Link className="panel staff-list-row" to="/mobile/devices">
        <Camera size={22} />
        <div>
          <strong>
            {bridge.ownPair ? "Connected to Counter" : "No Counter Paired"}
          </strong>
          <small>
            {bridge.ownPair
              ? "Your staff phone connection"
              : "Pair a counter to receive photo requests"}
          </small>
        </div>
        <ArrowUpRight size={18} />
      </Link>
      {session.profile?.role === "employee" && (
        <article className="panel staff-list-row">
          <Activity size={22} />
          <div>
            <strong>My Shift</strong>
            <small>
              {shift.data?.data
                ? shift.data.data.status +
                  " · " +
                  (shift.data.data.actualStart || shift.data.data.scheduledStart
                    ? new Date(
                        shift.data.data.actualStart ||
                          shift.data.data.scheduledStart,
                      ).toLocaleTimeString("en", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Start time not recorded")
                : "No current shift scheduled"}
            </small>
          </div>
        </article>
      )}
      <section className="staff-section">
        <h2>Quick actions</h2>
        <div className="staff-action-grid">
          {staffService.allow('products.create')&&<Link className="panel" to="/mobile/products?new=1"><PackagePlus/><span>Add Product</span><small>Details, camera & gallery</small></Link>}
          <button
            className="panel"
            onClick={() => window.dispatchEvent(new Event("taha-scan-open"))}
          >
            <ScanLine />
            <span>Scan</span>
            <small>Products, locations & QR</small>
          </button>
          <Link className="panel" to="/mobile/activity">
            <Camera />
            <span>Photo Requests</span>
            <small>
              {requests ? `${requests} waiting` : "Ready when you are"}
            </small>
          </Link>
          {staffService.allow("inventory.view") && (
            <Link className="panel" to="/mobile/products?action=photo">
              <Camera />
              <span>Take Product Photo</span>
              <small>Find a product first</small>
            </Link>
          )}
          {staffService.allow("inventory.view") && (
            <Link className="panel" to="/mobile/inventory">
              <Boxes />
              <span>Inventory</span>
              <small>Stock & locations</small>
            </Link>
          )}
          <Link className="panel" to="/mobile/activity?tab=approvals">
            <Activity />
            <span>Approvals</span>
            <small>Your permitted requests</small>
          </Link>
          {staffService.allow("sales.view") && (
            <Link className="panel" to="/mobile/display">
              <Monitor />
              <span>Customer Display</span>
              <small>Live counter preview</small>
            </Link>
          )}
        </div>
      </section>
      {stock.data && (
        <Link className="panel staff-list-row" to="/mobile/products">
          <Boxes />
          <div>
            <strong>Low Stock</strong>
            <small>Products at or below reorder level</small>
          </div>
          <b>
            {
              stock.data.data.filter((p) => p.quantity <= p.low_stock_level)
                .length
            }
          </b>
        </Link>
      )}
      <section className="staff-section">
        <div className="staff-section-heading">
          <h2>Recent activity</h2>
          <Link to="/mobile/activity" aria-label="View all activity">
            <ArrowUpRight size={20} />
          </Link>
        </div>
        {data?.activity?.length ? (
          data.activity.slice(0, 5).map((item) => (
            <article className="staff-activity-row" key={item.id}>
              <span className="staff-row-icon">
                <Activity size={18} />
              </span>
              <div>
                <strong>{item.text}</strong>
                <small>{item.time}</small>
              </div>
              {item.amount !== null && <span>{currency(item.amount)}</span>}
            </article>
          ))
        ) : (
          <p className="panel staff-empty-copy">
            Photo requests and shop updates appear in Activity.
          </p>
        )}
      </section>
    </div>
  );
}
