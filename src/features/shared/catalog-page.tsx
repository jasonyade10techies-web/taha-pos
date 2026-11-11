import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Download } from "lucide-react";
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterBar,
  QueryState,
  RecordForm,
  type Column,
  type FormField,
  type FormValues,
} from "../../components/ui/workspace";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useAction, useRepository } from "../../hooks/use-repository";
import { exportCsv } from "../../lib/export";
import { localDemoEnabled } from "../../lib/config";

export function CatalogPage<T extends { id: string }>({
  title,
  subtitle,
  load,
  columns,
  fields,
  initial,
  values,
  save,
  detail,
  extra,
  renderFormExtra,
  onEdit,
}: {
  title: string;
  subtitle: string;
  load: () => Promise<T[]>;
  columns: Column<T>[];
  fields?: FormField[];
  initial?: FormValues;
  values?: (row: T) => FormValues;
  save?: (values: FormValues, id?: string) => Promise<unknown>;
  detail?: (row: T) => string;
  extra?: ReactNode;
  renderFormExtra?: (row: T | null) => ReactNode;
  onEdit?: () => void;
}) {
  const query = useRepository(title, load);
  const action = useAction();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<T | null | undefined>(undefined);
  const rows = (query.data ?? []).filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <>
            {extra}
            {save && (
              <Button
                variant="primary"
                onClick={() => {
                  onEdit?.();
                  setEditing(null);
                }}
              >
                <Plus size={16} />
                Add {title.replace(/s$/, "")}
              </Button>
            )}
          </>
        }
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} />
        <Button
          onClick={() =>
            exportCsv(
              title,
              rows
                .map((row) =>
                  Object.fromEntries(
                    Object.entries(row).filter(
                      ([key]) =>
                        ![
                          "photo",
                          "photos",
                          "image",
                          "purchasePrice",
                          "purchaseCost",
                          "permissions",
                        ].includes(key),
                    ),
                  ),
                )
                .map((row) =>
                  Object.fromEntries(
                    Object.entries(row).map(([key, val]) => [
                      key,
                      String(val ?? ""),
                    ]),
                  ),
                ),
            )
          }
        >
          <Download size={16} />
          Export
        </Button>
      </FilterBar>
      <QueryState
        pending={query.isPending}
        error={query.isError}
        retry={() => void query.refetch()}
      >
        <DataTable
          rows={rows}
          columns={[
            ...columns,
            ...(save && !detail
              ? [
                  {
                    label: "Actions",
                    render: (row: T) => (
                      <Button
                        size="small"
                        onClick={() => {
                          onEdit?.();
                          setEditing(row);
                        }}
                      >
                        Edit
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
          onRow={detail ? (row) => navigate(detail(row)) : undefined}
        />
      </QueryState>
      {editing !== undefined && fields && save && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              onEdit?.();
              setEditing(undefined);
            }
          }}
          title={
            editing
              ? "Edit " + title.replace(/s$/, "")
              : "Add " + title.replace(/s$/, "")
          }
          description={
            localDemoEnabled
              ? "Changes are saved on this device in the local prototype."
              : "Changes are validated and saved to your Supabase branch."
          }
        >
          <RecordForm
            fields={fields}
            initial={editing && values ? values(editing) : (initial ?? {})}
            busy={action.busy}
            onSubmit={(v) =>
              void action.run(
                () => save(v, editing?.id),
                "Saved successfully",
                () => setEditing(undefined),
              )
            }
          >
            {renderFormExtra?.(editing)}
          </RecordForm>
          {action.error && (
            <p role="alert" className="text-danger">
              {action.error}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
