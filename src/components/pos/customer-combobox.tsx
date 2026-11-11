import { AppCheckbox } from '../ui/app-checkbox';
import Fuse from "fuse.js";
import {AnimatePresence,motion} from 'framer-motion';
import { ImageUploader } from "../ui/workspace";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, UserRound } from "lucide-react";
import type { Customer } from "../../types/demo";
import { repositories } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import { useCartStore } from "../../stores/cart-store";
import { usePermission } from "../../hooks/use-permission";
import { currency } from "../../lib/utils";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import "./customer-header.css";
import { publishCustomerDisplay } from "../../hooks/use-customer-display";

const walkIn: Customer = {
  id: "",
  name: "Walk-in Customer",
  type: "Individual",
  shopName: "",
  ownerName: "",
  collectingPerson: "",
  phone: "",
  address: "",
  notes: "",
  photo: "",
  creditLimit: null,
  createdAt: "",
};

export function CustomerCombobox({ disabled = false, value, onSelect, showIcon = true }: { disabled?: boolean; value?: string; onSelect?: (id: string) => void; showIcon?: boolean }) {
  const cartCustomer = useCartStore((s) => s.customerId);
  const customerId = value ?? cartCustomer;
  const root = useRef<HTMLDivElement>(null);
  const customers = useRepository("customers-combobox", () => repositories.customers.list());
  const preferences = useRepository("customer-selection-preferences",()=>repositories.settings.get());
  const selected = customers.data?.find((c) => c.id === customerId) ?? walkIn;
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const canCredit = usePermission("credit.create");
  const canReceiveCredit=usePermission("credit.receive_payment");
  const selectedBalance=useRepository("customer-outstanding-"+selected.id,()=>repositories.customers.outstanding(selected.id),!!selected.id&&(canCredit||canReceiveCredit));
  const canCreate = usePermission("customers.create");
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside); return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const matches = useMemo(() => {
    const all = customers.data ?? [];
    const q = query.trim().toLowerCase();
    return q
      ? new Fuse(all, { keys:["name","phone","shopName"], threshold:.32, ignoreLocation:true }).search(q).map(r => r.item)
      : [...all].sort((a, b) => preferences.data?.showRecentCustomers === false ? a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt));
  }, [customers.data, query,preferences.data?.showRecentCustomers]);
  const choose = (id: string) => {
    if (onSelect) onSelect(id);
    else {
      useCartStore.setState({ customerId: id });
      useCartStore.getState().setCoupon(false);
      publishCustomerDisplay({}, "customer.selected");
    }
    setOpen(false);
    setQuery("");
  };
  return (
    <>
      <div className="customer-combobox" ref={root} onKeyDown={e => { if (e.key === "Escape") setOpen(false); if (e.key === "ArrowDown") { e.preventDefault(); const buttons = [...root.current?.querySelectorAll<HTMLButtonElement>(".customer-option") ?? []]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[Math.min(index + 1, buttons.length - 1)]?.focus(); } if (e.key === "ArrowUp") { e.preventDefault(); const buttons = [...root.current?.querySelectorAll<HTMLButtonElement>(".customer-option") ?? []]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[Math.max(0, index - 1)]?.focus(); } }}>
        <button className="customer-combobox-trigger" type="button" disabled={disabled} onClick={() => setOpen((v) => !v)} aria-label="Select sale customer" aria-expanded={open}>
          {showIcon && <span className="customer-icon"><UserRound size={17} /></span>}
          <span className="customer-combobox-value"><strong title={selected.name}>{selected.name}</strong><small title={selected.phone}>{selected.id ? `${selected.type}${selected.phone ? ` · ${selected.phone}` : ""}${(canCredit||canReceiveCredit)&&selectedBalance.data!==undefined&&selectedBalance.data>0?` · Outstanding ${currency(selectedBalance.data)}`:""}` : "Retail sale"}</small></span>
          <ChevronDown size={15} />
        </button>
        <AnimatePresence>{open && (
          <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:.15}} className="customer-combobox-menu">
            <div className="customer-combobox-search"><Search size={16} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers..." aria-label="Search customers" /></div>
            {!query && <p className="customer-combobox-label">{preferences.data?.showRecentCustomers === false ? "Individuals & Businesses" : "Recent Customers"}</p>}
            <button className="customer-option" onClick={() => choose("")}><UserRound size={16} /><span>Walk-in Customer<small>Retail sale</small></span>{!customerId && <Check size={15} className="ml-auto" />}</button>
            {matches.map((c) => <button className="customer-option" key={c.id} onClick={() => choose(c.id)}><UserRound size={16} /><span><strong>{c.name}</strong><small>{c.type}{c.shopName ? ` · ${c.shopName}` : ""}{c.phone ? ` · ${c.phone}` : ""}</small></span>{customerId === c.id && <Check size={15} className="ml-auto" />}</button>)}
            {!matches.length && <p className="customer-combobox-empty">No matching customers.</p>}
            {(canCreate || canCredit) && preferences.data?.allowQuickAddCustomer !== false && <div className="customer-combobox-footer"><button className="text-link" onClick={() => { setAddOpen(true); setOpen(false); }}><Plus size={15} /> Add New Customer</button></div>}
          </motion.div>
        )}</AnimatePresence>
      </div>
      <AddCustomerDialog open={addOpen} onOpenChange={setAddOpen} canCredit={canCredit} onCreated={(c) => choose(c.id)} />
    </>
  );
}

function AddCustomerDialog({ open, onOpenChange, canCredit, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; canCredit: boolean; onCreated: (c: Customer) => void }) {
  const a = useAction();
  const [preparingPhoto,setPreparingPhoto] = useState(false);
  const [type, setType] = useState<Customer["type"]>("Individual");
  const [values, setValues] = useState({ name: "", phone: "", shopName: "", ownerName: "", address: "", notes: "", creditEnabled: false, creditLimit: "", photo: "" });
  const set = (key: keyof typeof values, value: string | boolean) => setValues((s) => ({ ...s, [key]: value }));
  const save = () => void a.run(() => repositories.customers.save({ id: crypto.randomUUID(), name: values.name.trim(), type, shopName: values.shopName.trim(), ownerName: values.ownerName.trim(), collectingPerson: "", phone: values.phone.trim(), address: values.address.trim(), notes: values.notes.trim(), photo: values.photo, creditLimit: canCredit && values.creditEnabled && values.creditLimit !== "" ? Number(values.creditLimit) : null, creditEnabled: canCredit && values.creditEnabled, createdAt: new Date().toISOString() }), "Customer saved", (c) => { onCreated(c); onOpenChange(false); setValues({ name: "", phone: "", shopName: "", ownerName: "", address: "", notes: "", creditEnabled: false, creditLimit: "", photo: "" }); });
  return <Dialog open={open} onOpenChange={onOpenChange} title="Add New Customer" description="Save a customer without leaving the current sale." className="dialog-wide"><div className="form-grid"><label className="form-field">Customer Type<span className="theme-options">{(["Individual", "Shop / Business"] as const).map(t => <button key={t} type="button" className={type === t ? "selected" : ""} aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>)}</span></label><label className="form-field">Name<input className="input" value={values.name} onChange={(e) => set("name", e.target.value)} autoFocus required /></label><label className="form-field">Phone<input className="input" inputMode="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} /></label>{type === "Shop / Business" && <><label className="form-field">Business Name<input className="input" value={values.shopName} onChange={(e) => set("shopName", e.target.value)} /></label><label className="form-field">Owner Name (optional)<input className="input" value={values.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></label></>}<label className="form-field wide">Address (optional)<input className="input" value={values.address} onChange={(e) => set("address", e.target.value)} /></label><label className="form-field wide">Notes (optional)<textarea className="input" value={values.notes} onChange={(e) => set("notes", e.target.value)} /></label>{canCredit && <label className="form-field checkbox-field wide"><AppCheckbox type="checkbox" checked={values.creditEnabled} onChange={(e) => set("creditEnabled", e.target.checked)} /> Enable credit for this customer</label>}{canCredit && values.creditEnabled && <label className="form-field">Credit limit (PKR)<input className="input" type="number" min="0" value={values.creditLimit} onChange={e => set("creditLimit", e.target.value)}/><small>Leave blank for no configured limit.</small></label>}<div className="field-wide"><ImageUploader value={values.photo} onChange={image => set("photo", image)} label="Choose customer photo" onBusyChange={setPreparingPhoto}/></div></div>{a.error && <p className="text-danger mt-3" role="alert">{a.error}</p>}<div className="dialog-actions"><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={!values.name.trim() || a.busy || preparingPhoto || (values.creditEnabled && !values.phone.trim()) || (values.creditLimit !== "" && (!Number.isFinite(Number(values.creditLimit)) || Number(values.creditLimit) < 0))} onClick={save}>{a.busy ? "Saving…" : "Save Customer"}</Button></div></Dialog>;
}
