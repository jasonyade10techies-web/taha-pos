import {nativeDesktop} from './desktop/runtime';
export interface ReceiptPrinter {
  print(element: HTMLElement, format: "receipt" | "invoice"): void;
}
/** Isolate the print root: invisible app layout must not create extra paper pages. */
export class BrowserPrinter implements ReceiptPrinter {
  print(element: HTMLElement, format: "receipt" | "invoice") {
    document.querySelector(".taha-print-root")?.remove();
    const root = document.createElement("div");
    root.className = `taha-print-root ${format}-print-root`;
    root.append(element.cloneNode(true));
    document.body.append(root);
    // CSS does not accept "80mm auto". Measure the isolated receipt at its print
    // width and use a valid physical page size instead of inheriting an A4 sheet.
    let size = "A4 portrait";
    if (format === "receipt") {
      root.style.cssText =
        "display:block;position:absolute;left:-10000px;top:0;width:80mm";
      const paper = root.firstElementChild as HTMLElement;
      paper.style.width = "80mm";
      paper.style.padding = "2mm 3mm";
      paper.style.boxSizing = "border-box";
      size = `80mm ${Math.ceil((paper.getBoundingClientRect().height * 25.4) / 96) + 2}mm`;
      root.removeAttribute("style");
    }
    const page = document.createElement("style");
    page.textContent = `@media print{@page{size:${size};margin:${format === "invoice" ? "12mm" : "0"}}}`;
    root.append(page);
    document.body.dataset.printFormat = format;
    const cleanup = () => {
      root.remove();
      delete document.body.dataset.printFormat;
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }
}
/** WebView2 uses the same isolated white-paper print document. No network or
 * printer-specific driver integration is required to generate a local receipt. */
export class WindowsPrinter extends BrowserPrinter {}
export interface EscPosTransport {send(bytes:Uint8Array):Promise<void>}
export class EscPosPrinter {constructor(private transport:EscPosTransport){}sendReceipt(bytes:Uint8Array){return this.transport.send(bytes);}}
export const receiptPrinter = nativeDesktop ? new WindowsPrinter() : new BrowserPrinter();
