import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  QueryState,
  Tabs,
  PermissionToggle,
  RecordForm,
  DataTable,
  StatusBadge,
  EmployeeAvatar,
  type FormField,
} from "../../components/ui/workspace";
import { CatalogPage } from "../shared/catalog-page";
import { options, text, stamp } from "../shared/format";
import { Button } from "../../components/ui/button";
import { permissionKeys, type PermissionKey } from "../../types/auth";
import { usePermission } from "../../hooks/use-permission";
import { apiEnabled, localDemoEnabled, demoPinEnabled } from "../../lib/config";
import { write } from "../../lib/api/catalog-repositories";
import { allowed } from "../../lib/supabase/repository-utils";
import { PinAssignment } from "./pin-assignment";
import { useSessionStore } from "../../stores/session-store";
import {currency} from '../../lib/utils';
export function EmployeesPage() {
  const manage = usePermission("employees.manage");
  return (
    <CatalogPage
      title="Employees"
      subtitle="Employee profiles, shifts and explicit business permissions."
      load={() => r.employees.list()}
      detail={(e) => "/employees/" + e.id}
      extra={
        <Link className="button button-secondary" to="/counter">
          Switch Employee
        </Link>
      }
      columns={[
        {
          label: "Employee",
          render: (e) => (
            <div className="flex items-center gap-3">
              <EmployeeAvatar name={e.full_name} />
              <div>
                <strong>{e.full_name}</strong>
                <small className="cell-secondary">{e.email}</small>
              </div>
            </div>
          ),
        },
        { label: "Role", render: (e) => e.role },
        { label: "Status", render: (e) => <StatusBadge status={e.status} /> },
        { label: "Shift", render: (e) => e.shift },
        { label: "Last Activity", render: (e) => stamp(e.lastActivity) },
      ]}
      fields={[
        ...(!localDemoEnabled && !apiEnabled
          ? [
              {
                key: "authId",
                label: "Existing Supabase Auth user UUID",
                required: true,
              },
            ]
          : []),
        { key: "name", label: "Full name", required: true },
        { key: "email", label: "Email", type: "email", required: apiEnabled },
        ...(apiEnabled ? [{key:"password",label:"Initial password (12 characters minimum)",type:"password" as const,required:true,help:"Share the initial password privately. The employee can change it in Profile."}] : []),
        { key: "phone", label: "Phone" },
        {
          key: "role",
          label: "Role",
          type: "select",
          options: options(["manager", "employee"]),
          required: true,
        },
      ]}
      initial={{ role: "employee" }}
      save={
        manage
          ? async (v, id) => {
              if (apiEnabled && !id) return write("/employees/accounts", { fullName:text(v.name),email:text(v.email),phone:text(v.phone),password:text(v.password),role:text(v.role),permissions:[] });
              return r.employees.save({
                id:
                  id ??
                  (localDemoEnabled || apiEnabled ? crypto.randomUUID() : text(v.authId)),
                full_name: text(v.name),
                email: text(v.email),
                phone: text(v.phone),
                role: text(v.role) as "manager" | "employee",
                status: "active",
                avatar_url: null,
                permissions: localDemoEnabled
                  ? ["sales.create", "inventory.view"]
                  : [],
                shift: "Not scheduled",
                lastActivity: new Date().toISOString(),
              });
            }
          : undefined
      }
    />
  );
}
export function EmployeeDetailPage() {
  const canViewReceipts=usePermission('sales.view');
  const { id = "" } = useParams();
  const q = useRepository("employee-" + id, async () => ({
    employee: await r.employees.get(id),
    shifts: (localDemoEnabled ? await r.shifts.list() : []).filter(
      (s) => s.employeeId === id,
    ),
    audit: (localDemoEnabled || allowed("audit.view")
      ? await r.audit.list()
      : []
    ).filter((e) => e.employeeId === id),
  }));
  const a = useAction();
  const [tab, setTab] = useState("Profile");
  const [permissions, setPermissions] = useState<PermissionKey[] | null>(null);
  const canManage = usePermission("employees.permissions");
  const canEdit = usePermission("employees.manage");
  const currentId = useSessionStore((s) => s.profile?.id);
  const e = q.data?.employee;
  const selected = permissions ?? e?.permissions ?? [];
  const fields: FormField[] = [
    { key: "name", label: "Full name", required: true },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone" },
    {
      key: "role",
      label: "Role",
      type: "select",
      options: options(["owner", "manager", "employee"]),
      required: true,
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: options(["active", "inactive"]),
      required: true,
    },
  ];
  return (
    <>
      <PageHeader
        title={e?.full_name ?? "Employee"}
        subtitle={
          localDemoEnabled
            ? "Profile, permissions and activity on this device."
            : apiEnabled ? "Internal accounts and explicit branch permissions." : "Internal profiles and explicit branch permissions. Provision the Auth user in trusted Supabase administration first."
        }
      />
      <Tabs
        items={[
          "Profile",
          "Permissions",
          ...(localDemoEnabled ? ["Shifts"] : []),
          "Activity",
          ...(canViewReceipts?['Receipts / Transactions']:[]),
        ]}
        value={tab}
        onChange={setTab}
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {e &&
          (tab === "Profile" ? (
            <section className="panel form-section">
              <RecordForm
                fields={fields}
                initial={{
                  name: e.full_name,
                  email: e.email ?? "",
                  phone: e.phone ?? "",
                  role: e.role,
                  status: e.status,
                }}
                busy={a.busy}
                disabled={
                  !canEdit ||
                  (!localDemoEnabled &&
                    (e.role === "owner" || e.id === currentId))
                }
                onSubmit={(v) =>
                  void a.run(
                    () =>
                      r.employees.save({
                        ...e,
                        full_name: text(v.name),
                        email: text(v.email),
                        phone: text(v.phone),
                        role: text(v.role) as typeof e.role,
                        status: text(v.status) as typeof e.status,
                      }),
                    "Employee updated",
                  )
                }
              />
              {demoPinEnabled && (
                <p className="auth-notice">
                  Demo PIN: 123456. Local switching is a prototype interaction
                  and does not provide production authentication.
                </p>
              )}
              {!localDemoEnabled && <PinAssignment profileId={e.id} />}
              {!localDemoEnabled &&
                (e.role === "owner" || e.id === currentId) && (
                  <p className="auth-notice">
                    Update your contact details in Your Profile. Owner
                    role/status changes require trusted Supabase administration.
                  </p>
                )}
            </section>
          ) : tab === "Permissions" ? (
            <section className="panel form-section">
              <h2>Granular Permissions</h2>
              <p className="text-muted text-sm mt-2 mb-4">
                Owners have unrestricted access. Managers and employees require
                explicit permissions.
              </p>
              <div className="permissions-grid">
                {permissionKeys.map((key) => (
                  <PermissionToggle
                    key={key}
                    label={key.replaceAll("_", " ").replace(".", " · ")}
                    checked={e.role === "owner" || selected.includes(key)}
                    disabled={!canManage || e.role === "owner"}
                    onChange={(checked) =>
                      setPermissions((s) =>
                        checked
                          ? [...(s ?? e.permissions), key]
                          : (s ?? e.permissions).filter((k) => k !== key),
                      )
                    }
                  />
                ))}
              </div>
              <Button
                className="mt-6"
                variant="primary"
                disabled={!canManage || e.role === "owner" || a.busy}
                onClick={() =>
                  void a.run(
                    () => r.employees.setPermissions(e.id, selected),
                    "Permissions updated",
                    () => setPermissions(null),
                  )
                }
              >
                Save Permissions
              </Button>
            </section>
          ) : tab==='Receipts / Transactions'?<EmployeeReceipts employeeId={id}/>:tab === "Shifts" ? (
            <DataTable
              rows={q.data?.shifts ?? []}
              columns={[
                { label: "Date", render: (s) => s.date },
                { label: "Time", render: (s) => s.start + " – " + s.end },
                {
                  label: "Status",
                  render: (s) => <StatusBadge status={s.status} />,
                },
              ]}
            />
          ) : (
            <DataTable
              rows={q.data?.audit ?? []}
              columns={[
                { label: "Action", render: (e) => e.description },
                { label: "Module", render: (e) => e.module },
                { label: "Date", render: (e) => stamp(e.createdAt) },
              ]}
            />
          ))}
      </QueryState>
    </>
  );
}
function EmployeeReceipts({employeeId}:{employeeId:string}) {
  const q=useRepository('employee-receipts-'+employeeId,()=>r.sales.page?.({employee:employeeId,limit:25})??Promise.resolve({rows:[],total:0,page:0,limit:25}));
  return <><Link className="button button-secondary" to={'/transactions?employee='+employeeId}>All receipts and filters</Link><QueryState pending={q.isPending} error={q.isError} retry={()=>void q.refetch()}><DataTable rows={q.data?.rows??[]} columns={[{label:'Invoice',render:s=><Link to={'/transactions/'+s.id}>{s.invoice}</Link>},{label:'Customer',render:s=>s.customerName},{label:'Date',render:s=>stamp(s.createdAt)},{label:'Amount',render:s=>currency(s.total)},{label:'Status',render:s=><StatusBadge status={s.status}/>}]} /></QueryState></>;
}
