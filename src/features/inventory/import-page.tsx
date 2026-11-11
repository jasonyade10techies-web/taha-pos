import { useRef, useState } from "react";
import { repositories } from "../../lib/repositories";
import { useAction } from "../../hooks/use-repository";
import { PageHeader, DataTable } from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { exportCsv } from "../../lib/export";
import type { ProductInput } from "../../types/demo";
function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(field.trim());
      field = "";
      if (c === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (c !== "\r") field += c;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function ProductImportPage() {
  const picker=useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<
    (ProductInput & { id: string; error: string })[]
  >([]);
  const [error, setError] = useState("");
  const a = useAction();
  const parse = async (file: File) => {
    try {
      if (file.size > 1024 * 1024)
        throw new Error("CSV files must be under 1 MB.");
      const [headers, ...data] = parseCsv(
        (await file.text()).replace(/^\uFEFF/, ""),
      );
      if (!headers?.includes("Name") || !headers.includes("Price"))
        throw new Error("Use the CSV template with Name and Price columns.");
      const locations = await repositories.locations.list();
      setRows(
        data.slice(0, 500).map((values, i) => {
          const v = Object.fromEntries(
            headers.map((h, j) => [h, values[j] ?? ""]),
          );
          const p: ProductInput & { id: string; error: string } = {
            id: "import-" + i,
            name: v.Name,
            category: (v.Category || "Parts") as ProductInput["category"],
            brand: v.Brand || "Generic",
            compatibleModel: v.Model || "",
            qualityGrade: v.Grade || "Grade A",
            color: v.Color || "",
            sellingPrice: Number(v.Price),
            minimumSellingPrice: Number(v.Minimum || 0),
            initialQuantity: Number(v.Quantity || 0),
            locationId:
              locations.find(
                (l) => l.code === v.Location && l.kind === "box" && !l.archived,
              )?.id ?? "",
            lowStockLevel: Number(v.LowStock || 5),
            aliases: (v.Aliases || "").split("|").filter(Boolean),
            state: "active",
            unit: "Piece",
            variant: v.Color || "",
            notes: "Imported from CSV",
            image: "",
            error: "",
          };
          p.error = !p.name
            ? "Missing name"
            : !["Parts", "Accessories", "Phones"].includes(p.category)
              ? "Invalid category"
              : !Number.isFinite(p.sellingPrice) || p.sellingPrice <= 0
                ? "Invalid price"
                : !Number.isFinite(p.minimumSellingPrice) ||
                    p.minimumSellingPrice < 0 ||
                    p.minimumSellingPrice > p.sellingPrice
                  ? "Invalid minimum"
                  : !Number.isInteger(p.initialQuantity) ||
                      p.initialQuantity < 0
                    ? "Invalid quantity"
                    : !p.locationId
                      ? "Unknown box code"
                      : "";
          return p;
        }),
      );
      setError("");
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Invalid CSV.");
    }
  };
  return (
    <>
      <PageHeader
        title="Import Products"
        subtitle="Preview and validate a CSV before adding products. Codes are generated automatically."
      />
      <section className="panel form-section">
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={() =>
              exportCsv("taha-products-template", [
                {
                  Name: "Samsung A15 Battery",
                  Category: "Parts",
                  Brand: "Samsung",
                  Model: "Galaxy A15",
                  Grade: "Original",
                  Color: "Black",
                  Price: 2300,
                  Minimum: 1900,
                  Quantity: 5,
                  Location: "TM-L-000003",
                  LowStock: 5,
                  Aliases: "battery|betri",
                },
              ])
            }
          >
            Download CSV Template
          </Button>
          <Button onClick={()=>picker.current?.click()}>Upload CSV</Button>
          <input hidden ref={picker}
            aria-label="Upload product CSV"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              if (e.target.files?.[0]) void parse(e.target.files[0]);
            }}
          />
        </div>
        <p className="text-muted text-sm mt-3">
          Use an active Box internal code from Locations. Maximum 500 rows; no
          purchase costs are imported.
        </p>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </section>
      {rows.length > 0 && (
        <>
          <DataTable
            rows={rows}
            columns={[
              { label: "Name", render: (p) => p.name },
              { label: "Price", render: (p) => p.sellingPrice },
              { label: "Quantity", render: (p) => p.initialQuantity },
              { label: "Validation", render: (p) => p.error || "Ready" },
            ]}
          />
          <Button
            variant="primary"
            className="mt-4"
            disabled={rows.some((p) => p.error) || a.busy}
            onClick={() =>
              void a.run(async () => {
                for (const row of rows) {
                  const { id, error, ...input } = row;
                  void id;
                  void error;
                  await repositories.products.save(input);
                  setRows((s) => s.filter((p) => p.id !== row.id));
                }
              }, "Products imported")
            }
          >
            Import {rows.length} Products
          </Button>
        </>
      )}
    </>
  );
}
