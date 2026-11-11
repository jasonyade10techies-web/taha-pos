export function exportCsv(
  filename: string,
  records: Record<string, string | number | boolean>[] | string[],
  values?: (string | number)[][],
) {
  const headers = values
    ? (records as string[])
    : Object.keys(records[0] ?? {});
  const rows =
    values ??
    (records as Record<string, string | number | boolean>[]).map((row) =>
      headers.map((key) => String(row[key] ?? "")),
    );
  const escape = (value: string | number) => {
    let text = String(value);
    if (/^[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    [
      "\uFEFF" +
        [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : filename + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
