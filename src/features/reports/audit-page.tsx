import { AppSelect } from '../../components/ui/app-select';
import { useState } from "react";
import { repositories as r } from "../../lib/repositories";
import { useRepository } from "../../hooks/use-repository";
import {
  PageHeader,
  DataTable,
  FilterBar,
  SearchInput,
  QueryState,
} from "../../components/ui/workspace";
import { stamp } from "../shared/format";
export function AuditPage() {
  const q = useRepository("audit", () => r.audit.list());
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [date, setDate] = useState("");
  const rows = (q.data ?? []).filter(
    (e) =>
      JSON.stringify(e).toLowerCase().includes(search.toLowerCase()) &&
      (!employee || e.employeeId === employee) &&
      (!module || e.module === module) &&
      (!action || e.action === action) &&
      (!date || e.createdAt.slice(0, 10) === date),
  );
  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Append-only local business history. Records cannot be edited or deleted here."
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} />
        <AppSelect
          className="input"
          aria-label="Audit employee"
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
        >
          <option value="">All employees</option>
          {Array.from(
            new Map(q.data?.map((e) => [e.employeeId, e.employeeName])),
          ).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </AppSelect>
        {[
          [module, setModule, "Module", "module"],
          [action, setAction, "Action", "action"],
        ].map(([value, set, label, key]) => (
          <AppSelect
            key={String(label)}
            className="input"
            aria-label={"Audit " + label}
            value={String(value)}
            onChange={(e) => (set as (v: string) => void)(e.target.value)}
          >
            <option value="">All {String(label).toLowerCase()}s</option>
            {Array.from(
              new Set(q.data?.map((e) => e[key as "action" | "module"])),
            ).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </AppSelect>
        ))}
        <input
          className="input"
          aria-label="Audit date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </FilterBar>
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <DataTable
          rows={rows}
          columns={[
            { label: "Employee", render: (e) => e.employeeName },
            { label: "Action", render: (e) => e.action },
            { label: "Module", render: (e) => e.module },
            { label: "Description", render: (e) => e.description },
            { label: "Reference", render: (e) => e.reference },
            { label: "Date", render: (e) => stamp(e.createdAt) },
          ]}
        />
      </QueryState>
    </>
  );
}
