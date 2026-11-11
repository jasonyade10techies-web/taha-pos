type Reader = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type DetectorConstructor = new (options: { formats: string[] }) => Reader;
/** Use the browser's barcode decoder where supported; Android uses the native ZXing activity. */
export async function decodeBarcode(source: CanvasImageSource) {
  const Detector = (
    window as unknown as { BarcodeDetector?: DetectorConstructor }
  ).BarcodeDetector;
  if (!Detector)
    throw new Error(
      "Barcode scanning is available in the Taha Staff Android app. Use QR mode in this browser.",
    );
  const values = await new Detector({
    formats: [
      "ean_13",
      "ean_8",
      "code_128",
      "code_39",
      "upc_a",
      "upc_e",
      "itf",
      "codabar",
    ],
  }).detect(source);
  return values[0]?.rawValue;
}
