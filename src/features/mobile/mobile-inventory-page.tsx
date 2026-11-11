import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Boxes, Search } from "lucide-react";
import { staffService } from "../../lib/mobile/staff-service";
export function MobileInventoryPage() {
  const [params] = useSearchParams(),
    [search, setSearch] = useState("");
  const locations = useQuery({
      queryKey: ["staff-locations"],
      queryFn: staffService.locations,
    }),
    balances = useQuery({
      queryKey: ["staff-balances"],
      queryFn: staffService.balances,
    }),
    products = useQuery({
      queryKey: ["staff-products"],
      queryFn: staffService.products,
    });
  const selected = params.get("location"),
    product = params.get("product");
  const rows = (locations.data?.data || []).filter(
    (l) =>
      (!selected || l.id === selected || l.internal_code === selected) &&
      l.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="staff-page">
      <div className="staff-page-heading">
        <span className="eyebrow">STOCK & LOCATIONS</span>
        <h1>Inventory</h1>
        <p>Read stock by rack, shelf and box.</p>
      </div>
      <label className="staff-search">
        <Search size={20} />
        <input
          value={search}
          aria-label="Search locations"
          placeholder="Find a rack, shelf or box…"
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {(locations.data?.cached || balances.data?.cached) && (
        <p className="staff-cache-label">
          Saved inventory · Reconnect for current balances
        </p>
      )}
      {[locations, balances, products].some((q) => q.isError) && (
        <p role="alert">
          Reconnect to load inventory that has not been saved yet.
        </p>
      )}
      {rows.map((l) => {
        const stock = (balances.data?.data || []).filter(
          (b) =>
            (() => {
              const ids = new Set([l.id]);
              let changed = true;
              while (changed) {
                changed = false;
                for (const child of locations.data?.data || [])
                  if (
                    child.parent_location_id &&
                    ids.has(child.parent_location_id) &&
                    !ids.has(child.id)
                  ) {
                    ids.add(child.id);
                    changed = true;
                  }
              }
              return ids.has(b.location_id);
            })() &&
            (!product || b.product_id === product),
        );
        return (
          <article className="panel staff-location-card" key={l.id}>
            <div className="staff-list-row">
              <MapPin />
              <div>
                <strong>{l.name}</strong>
                <small>
                  {l.internal_code} · {l.kind}
                </small>
              </div>
              <span>
                {stock.reduce((s, b) => s + Number(b.quantity), 0)} units
              </span>
            </div>
            {stock.map((b) => (
              <div
                className="staff-location-balance"
                key={b.product_id + b.location_id}
              >
                <span>
                  {products.data?.data.find((p) => p.id === b.product_id)
                    ?.name || "Product"}
                </span>
                <strong>{b.quantity}</strong>
              </div>
            ))}
          </article>
        );
      })}
      {!rows.length && locations.isSuccess && (
        <div className="staff-empty">
          <Boxes />
          <h2>No matching locations</h2>
        </div>
      )}
    </div>
  );
}
