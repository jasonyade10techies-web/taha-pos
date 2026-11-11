import type { Sale } from "../types/demo";
import { currency } from "./utils";
import {receiptPayments} from './payment-summary';
export async function qrImage(value: string) {
  const [{createElement},{renderToStaticMarkup},{QRCodeSVG}]=await Promise.all([import('react'),import('react-dom/server'),import('qrcode.react')]);
  const svg=renderToStaticMarkup(createElement(QRCodeSVG,{value,size:320,marginSize:4,level:'M',xmlns:'http://www.w3.org/2000/svg'}));
  const blob = new Blob([svg], {
      type: "image/svg+xml",
    }),
    url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 320, 320);
    context.drawImage(image, 0, 0, 320, 320);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function createInvoicePdf(sale: Sale) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(255, 193, 7);
  doc.rect(14, 12, 182, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(229, 57, 53);
  doc.text("TAHA MOBILES", 14, 25);
  doc.setTextColor(23, 24, 26);
  doc.setFontSize(14);
  doc.text("INVOICE", 14, 35);
  doc.text(sale.invoice, 14, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let headerY = 51;
  const metadata = [
    `${new Date(sale.createdAt).toLocaleString("en-PK", {timeZone: "Asia/Karachi"})}${sale.receipt?.showCashier===false?'':` · Cashier: ${sale.employeeName}`}`,
    [sale.receipt?.branch,sale.receipt?.phone].filter(Boolean).join(' · '),
    sale.receipt?.address,
    `Customer: ${sale.customerName}`,
    `Status: ${sale.syncStatus==='REFUNDED'?'REFUNDED IN FULL':sale.status.toUpperCase()}`,
  ].filter(Boolean);
  for (const field of metadata) {
    const lines = doc.splitTextToSize(String(field), 145);
    doc.text(lines, 14, headerY);
    headerY += lines.length * 5 + 2;
  }
  const qr = await qrImage(sale.receiptUrl??sale.invoice);
  if (qr) doc.addImage(qr, "PNG", 168, 23, 27, 27);
  autoTable(doc, {
    startY: headerY + 5,
    head: [["Item", "Qty", "Price", "Discount", "Amount"]],
    body: sale.lines.map((line) => [
      `${line.name}${line.variant ? " · " + line.variant : ""}`,
      line.quantity,
      currency(line.unitPrice),
      currency(line.discount),
      currency(line.total),
    ]),
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      textColor: [23, 24, 26],
      lineColor: [228, 231, 236],
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: { fillColor: [246, 247, 249], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 78 },
      1: { cellWidth: 12 },
      2: { cellWidth: 30 },
      3: { cellWidth: 26 },
      4: { cellWidth: 36 },
    },
    margin: { left: 14, right: 14, top: 18, bottom: 20 },
    showHead: "everyPage",
  });
  let y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;
  if (y > 210) {
    doc.addPage();
    y = 24;
  }
  const paymentTotals=receiptPayments(sale),
    summary = [
      ["Subtotal", sale.subtotal],
      ["Discount", sale.discount + (sale.couponDiscount ?? 0)],
      ...(sale.tax?.amount || sale.receipt?.showZeroTax
        ? [
            [
              `${sale.tax?.name ?? "Tax"} (${sale.tax?.rate ?? 0}%)`,
              sale.tax?.amount ?? 0,
            ],
          ]
        : []),
      ["Total", sale.total],
      ["Paid", paymentTotals.received],
      ...(paymentTotals.refunded>0?[["Refunded",paymentTotals.refunded]]:[]),
      ...(paymentTotals.reversed>0?[["Payment reversed",paymentTotals.reversed]]:[]),
      ...(paymentTotals.refunded>0||paymentTotals.reversed>0?[["Net paid",paymentTotals.paid]]:[]),
      ["Outstanding", paymentTotals.outstanding],
      ["Change", sale.change ?? 0],
    ];
  for (const [label, amount] of summary) {
    doc.setFont("helvetica", label === "Total" ? "bold" : "normal");
    doc.text(String(label), 115, y);
    doc.text(currency(Number(amount)), 196, y, { align: "right" });
    y += 7;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const payment of sale.payments) {
    const label =
      payment.methodName ??
      (payment.methodId === "cash"
        ? "Cash"
        : payment.methodId === "credit"
          ? "Credit"
          : payment.methodId);
    const lines = doc.splitTextToSize(
      `${payment.kind==='refund'?'Refund · ':payment.kind==='reversal'?'Reversal · ':''}${label}: ${currency(payment.amount)}${payment.reference ? " · " + payment.reference : ""}`,
      182,
    );
    if (y + lines.length * 5 > 268) {
      doc.addPage();
      y = 24;
    }
    doc.text(lines, 14, y);
    y += lines.length * 5 + 3;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(102, 112, 133);
    doc.text(
      doc
        .splitTextToSize(
          sale.receipt?.footer || "Thank you for choosing Taha Mobiles.",
          182,
        )
        .slice(0, 2),
      105,
      278,
      { align: "center" },
    );
    doc.text(`${sale.invoice} · ${page}/${pages}`, 105, 288, {
      align: "center",
    });
  }
  return doc;
}
export async function downloadInvoicePdf(sale: Sale) {
  const pdf = await createInvoicePdf(sale);
  pdf.save(`${sale.invoice}.pdf`);
}
