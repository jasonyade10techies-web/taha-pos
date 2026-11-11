import { AppSelect } from './app-select';
import { AppCheckbox } from './app-checkbox';
import {
  useState,
  useId,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Search,
  PackageSearch,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "./button";
import { Badge } from "./badge";
import { Dialog } from "./dialog";
import { MediaUploader } from "../media/media-uploader";
import { InfoTooltip } from "./info-tooltip";
import { currency } from "../../lib/utils";
import { localDemoEnabled } from "../../lib/config";
import {useMediaPreparation} from "../../hooks/use-media-preparation";
import {DateTimeInput} from './date-time-input';
import {DatePicker} from './date-picker';

export { PageHeading as PageHeader } from "./page-heading";
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  label = "Search records",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="management-search">
      <Search size={17} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  );
}
export const FilterBar = ({ children }: { children: ReactNode }) => (
  <div className="filter-bar">{children}</div>
);
export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const text = status.toLowerCase();
  const tone = /overdue|out of stock|cancel|void|damaged|inactive/.test(text)
    ? "danger"
    : /low|due soon|due today|pending|partial|out$|waiting|scheduled|reserved/.test(text)
      ? "warning"
      : /credit/.test(text)
        ? "credit"
        : /paid|active|in stock|closed|returned|ready|delivered|received|converted/.test(
              text,
            )
          ? "success"
          : "info";
  return <Badge tone={tone}>{status}</Badge>;
}
export function EmptyState({
  title = "No records yet",
  description = "Add your first record to get started.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <PackageSearch size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  title = "Unable to load this page",
  description = localDemoEnabled
    ? "Check your browser storage and try again."
    : "Check your connection and branch permissions. Confirm the database migrations are applied, then retry.",
  retry,
}: {
  title?: string;
  description?: string;
  retry: () => void;
}) {
  return (
    <section className="panel empty-state">
      <AlertTriangle size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      <Button onClick={retry}>Retry</Button>
    </section>
  );
}
export function LoadingSkeleton() {
  return (
    <div
      className="loading-skeleton panel"
      role="status"
      aria-label="Loading records"
    >
      <div />
      <div />
      <div />
      <div />
    </div>
  );
}
export function QueryState({
  pending,
  error,
  retry,
  children,
}: {
  pending: boolean;
  error: boolean;
  retry: () => void;
  children: ReactNode;
}) {
  return pending ? (
    <LoadingSkeleton />
  ) : error ? (
    <ErrorState retry={retry} />
  ) : (
    children
  );
}
export type Column<T> = {
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
};
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  emptyTitle,
  onRow,
  pageSize = 20,
  serverPagination,
}: {
  rows: T[];
  columns: Column<T>[];
  emptyTitle?: string;
  onRow?: (row: T) => void;
  pageSize?: number;
  serverPagination?: {page:number;total:number;onPage:(page:number)=>void};
}) {
  const [page, setPage] = useState(0);
  const actual = serverPagination?.page ?? Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / pageSize) - 1),
  );
  return (
    <section className="panel management-table">
      {rows.length ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.label} className={c.className}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(serverPagination ? rows : rows.slice(actual * pageSize, (actual + 1) * pageSize))
                  .map((row) => (
                    <tr
                      key={row.id}
                      onClick={event => {
                        const target=event.target;
                        if(target instanceof Element&&target.closest('a,button,input,select,textarea,label,[role="button"],[role="checkbox"]'))return;
                        onRow?.(row);
                      }}
                      tabIndex={onRow ? 0 : undefined}
                      onKeyDown={e => { if (onRow && e.target === e.currentTarget && ["Enter", " "].includes(e.key)) {e.preventDefault();onRow(row);} }}
                      className={onRow ? "clickable-row" : ""}
                    >
                      {columns.map((c) => (
                        <td
                          key={c.label}
                          data-label={c.label}
                          className={c.className}
                        >
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>
              {actual * pageSize + 1}–
              {Math.min((actual + 1) * pageSize, serverPagination?.total ?? rows.length)} of {serverPagination?.total ?? rows.length}{" "}
              records
            </span>
            <div>
              <Button
                size="small"
                disabled={!actual}
                aria-label="Previous page"
                onClick={() => serverPagination ? serverPagination.onPage(actual-1) : setPage(actual - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                size="small"
                disabled={(actual + 1) * pageSize >= (serverPagination?.total ?? rows.length)}
                aria-label="Next page"
                onClick={() => serverPagination ? serverPagination.onPage(actual+1) : setPage(actual + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title={emptyTitle ?? "No records match your filters"}
          description="Try another search or add a new record."
        />
      )}
    </section>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="management-tabs" role="tablist">
      {items.map((item) => (
        <button
          role="tab"
          key={item}
          aria-selected={value === item}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel form-section">
      <div className="form-section-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="form-grid">{children}</div>
    </section>
  );
}
export function Field({
  label,
  children,
  help,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  help?: string;
  wide?: boolean;
}) {
  const id = useId();
  let target = "";
  const controls = Children.map(children, (child, index) => {
    if (
      isValidElement<{ "aria-label"?: string; id?: string }>(child) &&
      ((typeof child.type === "string" &&
        ["input", "textarea", "select"].includes(child.type)) ||
        child.type === CurrencyInput ||
        child.type === QuantityInput || child.type === AppSelect || child.type === AppCheckbox)
    ) {
      const controlId = child.props.id ?? `${id}-${index}`;
      if (!target) target = child.type === AppSelect ? `${controlId}-trigger` : controlId;
      return cloneElement(child, {
        id: controlId,
        "aria-label": child.props["aria-label"] ?? label,
      });
    }
    return child;
  });
  return (
    <div className={`form-field ${wide ? "field-wide" : ""}`}>
      <label htmlFor={target || undefined}>{label}</label>{help && <InfoTooltip label={help}/>}
      {controls}
      {help && <small>{help}</small>}
    </div>
  );
}
export function CurrencyInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <div className="amount-field">
      <span>PKR</span>
      <input type="number" min="0" step="0.01" {...props} />
    </div>
  );
}
export function QuantityInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input className="input" type="number" min="1" step="1" {...props} />;
}
export function PermissionToggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="permission-toggle">
      <span>{label}</span>
      <AppCheckbox
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </label>
  );
}
export function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
  busy = false,
  confirm = "Confirm",
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  confirm?: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title={title}
      description={description}
    >
      <div className="dialog-actions">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirm}
        </Button>
      </div>
    </Dialog>
  );
}
export function ImageUploader({ value, onChange, label = "Upload image", evidence = false, onBusyChange, phoneAction }: {
  value: string; onChange: (value: string) => void; label?: string; evidence?: boolean; onBusyChange?:(busy:boolean)=>void;phoneAction?:ReactNode;
}) {
  return <MediaUploader values={value ? [value] : []} onChange={images => onChange(images[0] ?? "")} label={label} evidence={evidence} onBusyChange={onBusyChange} phoneAction={phoneAction}/>;
}
export type FormValue = string | number | boolean;
export type FormValues = Record<string, FormValue>;
export type FormField = {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "time"
    | "datetime"
    | "email"
    | "password"
    | "textarea"
    | "select"
    | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  help?: string;
  wide?: boolean;
  visibleWhen?: (values:FormValues)=>boolean;
};
export function RecordForm({
  fields,
  initial,
  onSubmit,
  busy = false,
  children,
  submit = "Save",
  disabled = false,
  overrides,
  onValuesChange,
}: {
  fields: FormField[];
  initial: FormValues;
  onSubmit: (values: FormValues) => void;
  busy?: boolean;
  children?: ReactNode;
  submit?: string;
  disabled?: boolean;
  overrides?: FormValues;
  onValuesChange?: (values:FormValues)=>void;
}) {
  const [storedValues, setValues] = useState(initial);
  const media = useMediaPreparation();
  const values = { ...storedValues, ...overrides };
  const change = (key: string, value: FormValue) => {
    const next={...storedValues,[key]:value};setValues(next);onValuesChange?.({...next,...overrides});
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || busy || media.preparing) return;
    onSubmit(values);
  };
  return (
    <form ref={media.ref} onSubmit={send} className="record-form">
      <div className="form-grid">
        {fields.filter(field=>!field.visibleWhen || field.visibleWhen(values)).map((field) => (
          <Field
            key={field.key}
            label={field.label}
            help={field.help}
            wide={field.wide}
          >
            {field.type === "checkbox" ? (
              <AppCheckbox
                type="checkbox"
                checked={Boolean(values[field.key])}
                onChange={(e) => change(field.key, e.target.checked)}
              />
            ) : field.type === "select" ? (
              <AppSelect
                className="input"
                value={String(values[field.key] ?? "")}
                onChange={(e) => change(field.key, e.target.value)}
                required={field.required}
              >
                <option value="">Select…</option>
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </AppSelect>
            ) : field.type==='date'?<DatePicker label={field.label} value={String(values[field.key]??'')} required={field.required} onChange={value=>change(field.key,value)}/>:field.type==='datetime'?<DateTimeInput label={field.label} value={String(values[field.key]??'')} required={field.required} onChange={value=>change(field.key,value)}/>:field.type === "textarea" ? (
              <textarea
                className="input"
                value={String(values[field.key] ?? "")}
                onChange={(e) => change(field.key, e.target.value)}
                required={field.required}
              />
            ) : (
              <input
                className="input"
                type={field.type ?? "text"}
                value={String(values[field.key] ?? "")}
                onChange={(e) =>
                  change(
                    field.key,
                    field.type === "number" && e.target.value !== ""
                      ? Number(e.target.value)
                      : e.target.value,
                  )
                }
                required={field.required}
                min={field.min}
                max={field.max}
                step={field.type === "number" ? "0.01" : undefined}
              />
            )}
          </Field>
        ))}
      </div>
      {children}
      <div className="form-actions">
        <Button variant="primary" type="submit" disabled={busy || disabled || media.preparing}>
          {busy ? "Saving…" : submit}
        </Button>
      </div>
    </form>
  );
}
export const LocationBadge = ({ path }: { path: string }) => (
  <span className="location-badge">{path || "Unassigned"}</span>
);
export const PriceBadge = ({ value }: { value: number }) => (
  <strong className="tabular-nums">{currency(value)}</strong>
);
export const EmployeeAvatar = ({ name }: { name: string }) => (
  <span className="avatar">
    {name
      .split(" ")
      .slice(0, 2)
      .map((s) => s[0])
      .join("")}
  </span>
);
