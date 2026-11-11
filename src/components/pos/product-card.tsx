import { MapPin, Plus, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { PosProduct } from "../../types/product";
import { useCartStore } from "../../stores/cart-store";
import { currency } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { ProductThumbnail } from "../ui/product-thumbnail";
import { Button } from "../ui/button";
import {repositories} from '../../lib/repositories';
import {toast} from '../../stores/toast-store';
import {Link} from 'react-router-dom';
import {usePermission} from '../../hooks/use-permission';

export function ProductCard({ product }: { product: PosProduct }) {
  const add = useCartStore((s) => s.add);
  const canInspect=usePermission('inventory.view');
  const allowNegativeStock = useCartStore((s) => s.allowNegativeStock);
  const inCart = useCartStore(
    (s) =>
      s.items.find((item) => item.product.id === product.id)?.quantity ?? 0,
  );
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 700);
    return () => window.clearTimeout(timer);
  }, [added]);
  const out = product.quantity <= 0;
  const low = product.quantity <= product.lowStockLevel;
  const service = product.category === "Services";
  return (
    <article className="product-card">
      <div className="product-card-top">
        <ProductThumbnail product={product} />
        <div className="product-info">
          <span className="product-code">
            {product.internalCode} <span>· {product.category}</span>
          </span>
          <h3>{product.name}</h3>
          <p>{product.compatibleModel}</p>
          <div className="product-variants">
            <span>{product.qualityGrade}</span>
            {product.color && <span>{product.color}</span>}
          </div>
        </div>
      </div>
      <div className="product-pricing">
        <strong>{currency(product.sellingPrice)}</strong>
        <span>Minimum {currency(product.minimumSellingPrice)}</span>
      </div>
      <div className="product-stock">
        <Badge tone={service ? "neutral" : out ? "danger" : low ? "warning" : "success"} dot>
          {service ? "SERVICE" : out ? "OUT OF STOCK" : low ? "LOW STOCK" : "IN STOCK"}
        </Badge>
        <span>{service ? "Service" : `Stock ${product.quantity}`}</span>
      </div>
      {!service&&(product.damagedQuantity??0)>0&&<div className="product-stock" aria-label="Unavailable stock">
        {canInspect?<Link className="stock-count-link damaged" to={'/products/'+product.id+'?view=stock'} title="View quarantine locations, reasons and movement history">Damaged / Quarantine {product.damagedQuantity}</Link>:<span>Damaged / Quarantine {product.damagedQuantity}</span>}
        <small>Not available for sale</small>
      </div>}
      <div className="product-card-bottom">
        <span
          className="product-location"
          title={
            product.location
              ? `Rack ${product.location.rack} → Shelf ${product.location.shelf} → Box ${product.location.box}`
              : undefined
          }
        >
          <MapPin size={13} />
          {product.location
            ? `Rack ${product.location.rack} · Shelf ${product.location.shelf} · Box ${product.location.box}`
            : service ? "In-store service" : "Location not assigned"}
        </span>
        <motion.div
          animate={added ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.18 }}
        >
          <Button
            size="small"
            className={`product-add ${added ? "added" : ""}`}
            disabled={
              !service &&
              !allowNegativeStock &&
              (out || inCart >= product.quantity)
            }
            aria-label={`Add ${product.name}`}
            onClick={() => {
              if(service){
                void repositories.services.list().then(templates=>{
                  const template=templates.find(item=>item.id===product.id);
                  if(template?.linkedProductId)window.dispatchEvent(new CustomEvent('taha-service-template',{detail:template}));
                  else {add(product);setAdded(true);}
                }).catch(()=>toast('Could not check this service. Reconnect and retry.','error'));
                return;
              }
              add(product);setAdded(true);
            }}
          >
            {added ? <Check size={15} /> : <Plus size={15} />}
            {added ? "Added" : "Add"}
          </Button>
        </motion.div>
      </div>
    </article>
  );
}
