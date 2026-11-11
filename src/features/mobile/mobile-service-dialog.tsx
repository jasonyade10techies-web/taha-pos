import { useEffect,useMemo,useRef,useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { ServiceMaterialAllocation } from "../../components/pos/service-material-allocation";
import { apiRepositories as r } from "../../lib/api/repositories";
import {
  recognizeServiceMaterial,
  suggestServiceTemplates,
} from "../../lib/smart-services";
import { staffService } from "../../lib/mobile/staff-service";
import type { PosProduct } from "../../types/product";
import "../../styles/smart-services.css";
import {ServiceMentionComposer} from '../../components/pos/service-mention-composer';
import {CompoundPriceBreakdown} from '../../components/pos/compound-price-breakdown';
import {composerText,emptyServiceDocument,type ServiceDocument} from '../../lib/service-composer';
export function MobileServiceDialog({
  open,
  onClose,
  products,
  onAdd,
  initialName = "",
  initialTemplateId,
}: {
  open: boolean;
  onClose: () => void;
  products: PosProduct[];
  onAdd: (p: PosProduct,reason?:string) => void;
  initialName?: string;
  initialTemplateId?:string;
}) {
  const [document,setDocument] = useState<ServiceDocument>(()=>emptyServiceDocument(initialName)),
    [reason,setReason]=useState("Customer Bargaining"),
    [price, setPrice] = useState(""),
    [quantity, setQuantity] = useState(1),
    [values, setValues] = useState<Record<string, number>>({});
  const name=composerText(document),linked=document.mention?.productId??"";
  const [inspect,setInspect]=useState(false),[error,setError]=useState("");
  const templates = useQuery({
    queryKey: ["mobile-sale-services"],
    queryFn: () => r.services.list(),
    enabled: open,
  });
  const match = useMemo(
    () => recognizeServiceMaterial(products, name),
    [products, name],
  );
  const suggestions = suggestServiceTemplates(templates.data ?? [], name);
  const selected = products.find((p) => p.id === linked),
    canConsume = staffService.allow("services.consume_inventory");
  const appliedTemplate=useRef('');
  useEffect(()=>{
    if(!initialTemplateId||!templates.data||appliedTemplate.current===initialTemplateId)return;
    const template=templates.data.find(item=>item.id===initialTemplateId);appliedTemplate.current=initialTemplateId;
    const product=products.find(item=>item.id===template?.linkedProductId);
    if(!template||!product||!canConsume){setError('This saved material needs review at the counter.');return;}
    setDocument({before:'',mention:{productId:product.id,label:product.name},after:' '+(template.description||'service')});
    setPrice(String(product.sellingPrice+(template.defaultLaborCharge??0)));setQuantity(1);setValues({});
  },[initialTemplateId,templates.data,products,canConsume]);
  const locations = useQuery({
    queryKey: ["mobile-material-locations", linked],
    queryFn: () => r.services.materialLocations!(linked),
    enabled: open && !!selected && canConsume,
  });
  const rows = locations.data ?? [],
    allocation =
      rows.length === 1 ? { [rows[0].locationId]: quantity } : values;
  const allocations = rows
    .map((row) => ({
      locationId: row.locationId,
      quantity: allocation[row.locationId] ?? 0,
    }))
    .filter((row) => row.quantity > 0);
  const valid =
    !selected ||
    (Number.isInteger(quantity) &&
      quantity > 0 &&
      allocations.reduce((sum, a) => sum + a.quantity, 0) === quantity &&
      allocations.every(
        (a) =>
          Number.isInteger(a.quantity) &&
          a.quantity <=
            rows.find((row) => row.locationId === a.locationId)!.quantity,
      ));
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title="Add Custom Service"
      description="Name the work and enter one PKR charge. Choose any physical material explicitly."
      className="bottom-sheet mobile-service-sheet"
    >
      <label className="form-field">
        Service name
        <ServiceMentionComposer value={document} onChange={value=>{setDocument(value);setError("");}} products={products} canLink={canConsume} onSelectProduct={()=>{setValues({});setQuantity(1);}} onRemoveProduct={()=>{setValues({});}} onInspect={()=>setInspect(value=>!value)}/>
      </label>
      {suggestions.length > 0 && (
        <div
          className="service-suggestions"
          aria-label="Saved service suggestions"
        >
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                const product=products.find(p=>p.id===s.linkedProductId);
                if(s.linkedProductId&&(!product||!canConsume)){setError('This saved material needs review at the counter.');return;}
                setDocument(product?{before:'',mention:{productId:product.id,label:product.name},after:' '+(s.description||'service')}:emptyServiceDocument(s.name));
                setPrice(String(product?product.sellingPrice+(s.defaultLaborCharge??0):s.sellingPrice));
                setValues({});setQuantity(1);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <label className="form-field">
        Charge (PKR)
        <input
          className="input"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      {canConsume && !document.mention && !name.includes("@") && match.candidates.length > 0 && (
        <div className="service-match-options">
          <p>
            {match.kind === "ambiguous"
              ? "Choose the correct part, or keep this service labour only."
              : "Optional material — confirm the physical part used."}
          </p>
          {match.candidates.map((p) => (
            <button
              key={p.id}
              aria-pressed={linked === p.id}
              onClick={() => {
                setDocument({before:'',mention:{productId:p.id,label:p.name},after:' '+name});
                setValues({});
                setQuantity(1);
              }}
            >
              {p.name}
              <small>
                {p.qualityGrade} · {p.color} · {p.quantity} available
              </small>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <>
          <p className="linked-material-summary">Linked material: {selected.name} × {quantity} · {selected.quantity} available</p>
          {locations.isPending ? (
            <p role="status">Checking material stock…</p>
          ) : locations.isError ? (
            <p role="alert">
              Cannot check material locations. Reconnect and retry.
            </p>
          ) : (inspect||rows.length>1) ? (
            <ServiceMaterialAllocation
              product={selected}
              quantity={quantity}
              onQuantity={setQuantity}
              locations={rows}
              values={allocation}
              onAllocation={(id, n) => setValues({ ...allocation, [id]: n })}
            />
          ) : <p className="service-hint">{quantity} unit from {rows[0]?.path??"no sellable location"}</p>}
        </>
      )}
      {selected&&<><CompoundPriceBreakdown sellingPrice={selected.sellingPrice} minimum={selected.minimumSellingPrice} charge={Number(price)||0} quantity={quantity}/>{Number(price)<selected.sellingPrice*quantity&&<label className="form-field">Price reason<input className="input" value={reason} onChange={e=>setReason(e.target.value)}/></label>}{Number(price)<selected.minimumSellingPrice*quantity&&<p role="alert" className="text-danger">This price requires authorized review at the counter before it can be used.</p>}</>}
      <p className="mobile-sale-note">
        {selected
          ? "Linked material is deducted only after the server accepts checkout."
          : "Labour only · no physical stock will be consumed."}
      </p>
      {error&&<p className="text-danger" role="alert">{error}</p>}
      {!!document.mention&&!selected&&<p className="text-danger" role="alert">The linked product is unavailable. Choose another part.</p>}
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={
            !name.trim() ||
            !Number.isFinite(Number(price)) ||
            Number(price) <= 0 ||
            !!document.mention&&(!selected||!canConsume) || !valid || !!selected&&(Number(price)<selected.minimumSellingPrice*quantity||Number(price)<selected.sellingPrice*quantity&&(!staffService.allow("pricing.discount_within_range")||!reason.trim()))
          }
          onClick={() => {
            const charge = Math.round(Number(price) * 100) / 100;
            onAdd({
              id: "custom:" + crypto.randomUUID(),
              name: name.trim(),
              internalCode: "Custom Service",
              category: "Services",
              brand: "",
              compatibleModel: selected?.name??"",
              qualityGrade: "Custom Service",
              color: "",
              quantity: 0,
              sellingPrice: charge,
              minimumSellingPrice: 0,
              aliases: [],
              lowStockLevel: 0,
              location: null,
              customService: {
                name: name.trim(),
                description: "",
                sellingPrice: charge,
                minimumSellingPrice: 0,
                ...(selected
                  ? {
                      material: {
                        productId: selected.id,
                        quantity,
                        allocations,
                        pricing:{sellingPrice:selected.sellingPrice,minimumSellingPrice:selected.minimumSellingPrice,reviewedAt:new Date().toISOString()},
                      },
                    }
                  : {}),
              },
            },selected&&charge<selected.sellingPrice*quantity?reason:undefined);
            onClose();
          }}
        >
          Add to Sale
        </Button>
      </div>
    </Dialog>
  );
}
