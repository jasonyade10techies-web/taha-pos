import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, MapPin } from "lucide-react";
import { staffService } from "../../lib/mobile/staff-service";
import { currency } from "../../lib/utils";
import { MediaImage } from "../../components/media/media-image";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { MobileProductGallery } from "./mobile-product-gallery";
import {MobileProductEditor} from './mobile-product-editor';
import {searchProducts} from '../../lib/product-search';
export function MobileProductsPage() {
  const [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(params.get("code") || ""),
    [id, setId] = useState(params.get("id") || "");
  useEffect(() => {
    setSearch(params.get("code") || "");
    setId(params.get("id") || "");
  }, [params]);
  const query = useQuery({
    queryKey: ["staff-products"],
    queryFn: staffService.products,
  });
  const products = query.data?.data || [],
    selected = products.find((p) => p.id === id);
  const matches=new Set(searchProducts(products.map(p=>({...p,internalCode:p.internal_code,compatibleModel:p.compatible_model})),search).map(p=>p.id));
  const rows=products.filter(p=>matches.has(p.id)).slice(0,60);
  return (
    <div className="staff-page">
      <div className="staff-page-heading">
        <span className="eyebrow">QUICK LOOKUP</span>
        <h1>Products</h1>
        <p>Find stock and product details.</p>
      </div>
      <label className="staff-search">
        <Search size={20} />
        <input
          value={search}
          placeholder="Name, model or barcode…"
          aria-label="Search products"
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {query.data?.cached && (
        <p className="staff-cache-label">
          Saved products · Stock may have changed
        </p>
      )}
      {query.isPending && <p role="status">Loading products…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      <div className="staff-product-list">
        {rows.map((p) => (
          <button
            className="panel staff-product-row"
            key={p.id}
            onClick={() => setId(p.id)}
          >
            <span className="staff-product-image">
              {p.primary_image_url ? (
                <MediaImage
                  thumbnail
                  src={
                    p.primary_image_url.startsWith("http")
                      ? p.primary_image_url
                      : "taha-media:" + p.primary_image_url
                  }
                  loading="lazy"
                  alt=""
                />
              ) : (
                <Package size={24} />
              )}
            </span>
            <span>
              <strong>{p.name}</strong>
              <small>
                {p.compatible_model} · {p.quality_grade}
              </small>
              <span className="staff-product-price">
                {currency(Number(p.selling_price))}
              </span>
            </span>
            <span className="staff-stock-count">
              {p.quantity}
              <small>in stock</small>
            </span>
          </button>
        ))}
      </div>
      {!rows.length && !query.isPending && !query.isError && (
        <div className="staff-empty">
          <Package />
          <h2>Product not found</h2>
          <p>Try a name, phone model or internal code.</p>
        </div>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setId("");
            const next = new URLSearchParams(params);
            next.delete("id");
            setParams(next, { replace: true });
          }
        }}
        title={selected?.name || "Product"}
        className="bottom-sheet"
      >
        {selected && (
          <div className="staff-product-detail">
            <span className="eyebrow">{selected.internal_code}</span>
            <h2>{currency(Number(selected.selling_price))}</h2>
            <p>
              {selected.brand} · {selected.compatible_model} ·{" "}
              {selected.quality_grade} · {selected.color_variant}
            </p>
            <article className="panel staff-list-row">
              <Package />
              <div>
                <strong>{selected.quantity} units</strong>
                <small>
                  {query.data?.cached ? "Saved stock count" : "Available stock"}
                </small>
              </div>
            </article>
            {selected.location && (
              <p className="staff-location-line">
                <MapPin size={18} />
                {[
                  selected.location.rack,
                  selected.location.shelf,
                  selected.location.box,
                ]
                  .filter(Boolean)
                  .join(" → ")}
              </p>
            )}
            <Link to={"/mobile/inventory?product=" + selected.id}>
              <Button>View Stock</Button>
            </Link>
            {staffService.allow("products.edit") && (
              <>
                <MobileProductEditor id={selected.id}/>
                <MobileProductGallery product={selected} />
              </>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
