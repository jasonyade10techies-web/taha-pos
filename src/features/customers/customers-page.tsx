import {MediaImage} from '../../components/media/media-image';
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Fuse from "fuse.js";
import { Users, Plus } from "lucide-react";
import { repositories } from "../../lib/repositories";
import { useRepository } from "../../hooks/use-repository";
import { usePermission } from "../../hooks/use-permission";
import { PageHeader, SearchInput, DataTable, QueryState } from "../../components/ui/workspace";
import { currency } from "../../lib/utils";
import type { Customer } from "../../types/demo";
export function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState(""), [type, setType] = useState("All");
  const canCreate = usePermission("customers.create"), legacyCreate = usePermission("credit.create");
  const canCredit = usePermission("credit.receive_payment"), creditCreate = usePermission("credit.create");
  const query = useRepository("customer-directory", async () => {
    const rows = await repositories.customers.list();
    return canCredit || creditCreate ? Promise.all(rows.map(async c => ({ ...c, outstanding: c.outstanding ?? await repositories.customers.outstanding(c.id) }))) : rows;
  });
  const rows = useMemo(() => {
    const all = query.data ?? [];
    const matching = search.trim() ? new Fuse(all, { keys: ["name", "phone", "shopName", "address", "id", "notes"], threshold: .32, ignoreLocation: true }).search(search).map(r => r.item) : all;
    return matching.filter(c => type === "All" || c.type === type);
  }, [search, type, query.data]);
  return <><PageHeader title="Customers" subtitle="Find customers, nearby shops, and their activity in one place." action={(canCreate || legacyCreate) && <Link className="button button-primary" to="/customers/new"><Plus size={16}/>Add Customer</Link>}/>
    <section className="panel customer-directory"><div className="customer-directory-tools"><SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, shop, address or customer ID…"/><div className="table-tabs">{["All", "Individual", "Shop / Business"].map(value => <button key={value} aria-pressed={type === value} className={type === value ? "active" : ""} onClick={() => setType(value)}>{value === "All" ? "All Customers" : value}</button>)}</div></div>
    <QueryState pending={query.isPending} error={query.isError} retry={() => void query.refetch()}><DataTable<Customer> rows={rows} emptyTitle="No customers found" columns={[{ label: "Customer", render: c => <div className="customer-table-identity">{c.photo ? <MediaImage src={c.photo} alt=""/> : <span><Users size={18}/></span>}<div><strong>{c.name}</strong><small>{c.shopName || c.id}</small></div></div> }, { label: "Type", render: c => c.type }, { label: "Phone", render: c => c.phone || "—" }, ...((canCredit || creditCreate) ? [{ label: "Outstanding", render: (c: Customer) => currency(c.outstanding ?? 0) }, { label: "Available Credit", render: (c: Customer) => c.creditEnabled === false ? "Disabled" : c.creditLimit === null ? "No limit" : currency(Math.max(0, c.creditLimit - (c.outstanding ?? 0))) }] : []), { label: "Status", render: c => c.status === "inactive" ? "Inactive" : "Active" }]} onRow={c => navigate(`/customers/${c.id}`)}/></QueryState>
    </section></>;
}
