import { useEffect, useRef, useState } from "react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { parseTahaQr, type TahaQr } from "../../lib/mobile/qr";
import { mobileTestBuild, bundledMobile } from "../../lib/mobile/runtime";
import { useShopConnectionStore } from "../../stores/shop-connection-store";
import { useMobilePreferences } from "../../stores/mobile-preferences-store";
import { ArrowLeft, Flashlight } from "lucide-react";
import { decodeBarcode } from "../../lib/mobile/barcode";
const go = (path: string) => {
  if (bundledMobile) location.hash = path;
  else location.assign(path);
};
function productDestination(value:string,byId=false){
 const current=bundledMobile?location.hash.slice(1):location.pathname;
 return (current.startsWith('/mobile/sales')?'/mobile/sales?':'/mobile/products?')+(byId?'id=':'code=')+encodeURIComponent(value);
}
function routeQr(qr: TahaQr) {
  if (qr.type === "receipt")
    return "/mobile/receipt?reference=" + encodeURIComponent(qr.reference);
  if (qr.type === "location")
    return "/mobile/inventory?location=" + encodeURIComponent(qr.code);
  if (qr.type === "product")
    return /^TM-P-/.test(qr.code)
      ? productDestination(qr.code)
      : productDestination(qr.code,true);
  if (qr.type === "pairing")
    return `/mobile/activity?terminal=${encodeURIComponent(qr.terminal)}&pair=${encodeURIComponent(qr.code)}`;
  return `/mobile/activity?terminal=${encodeURIComponent(qr.terminal)}&job=${encodeURIComponent(qr.requestId)}&claim=${encodeURIComponent(qr.token)}`;
}
export function QrScanner() {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<TahaQr | null>(null),
    [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false),
    [mode, setMode] = useState<"auto" | "qr" | "barcode">("auto"),
    [torch, setTorch] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    receivedRef = useRef<(value: string, barcode?: boolean) => void>(() => {});
  const received = (value: string, barcode = false) => {
    stream.current?.getTracks().forEach((t) => t.stop());
    if (barcode) {
      if (!/^[A-Za-z0-9 ._-]{1,128}$/.test(value)) {
        setError("Product not found.");
        return;
      }
      go(productDestination(value));
      setOpen(false);
      return;
    }
    try {
      if(value.startsWith('taha-mobile://enroll?')){window.dispatchEvent(new CustomEvent('taha-enrollment-qr',{detail:value}));setOpen(false);return;}
      const qr = parseTahaQr(value, mobileTestBuild, useShopConnectionStore.getState().baseUrl);
      if (
        qr.type === "pairing" &&
        qr.expiresAt &&
        Date.parse(qr.expiresAt) <= Date.now()
      )
        throw new Error("This QR code has expired. Generate a new one.");
      setError("");
      if (
        qr.type === "receipt" ||
        qr.type === "location" ||
        qr.type === "product" ||
        qr.shop === useShopConnectionStore.getState().baseUrl
      ) {
        go(routeQr(qr));
        setOpen(false);
      } else {
        setResult(qr);
        setOpen(true);
      }
    } catch (c) {
      setError(c instanceof Error ? c.message : "QR code not recognized.");
      setOpen(true);
    }
  };
  receivedRef.current = received;
  useEffect(() => {
    const start = () => {
      setMode("auto");
      setResult(null);
      setError("");
      setDenied(false);
      setOpen(true);
      window.TahaNative?.scanQr?.();
    };
    const scanned = (e: Event) => {
      const d = (
        e as CustomEvent<{
          value?: string;
          error?: string;
          mode?: string;
          format?: string;
        }>
      ).detail;
      if (d?.value)
        receivedRef.current(
          d.value,
          d.mode === "barcode" ||
            (d.format !== undefined && d.format !== "QR_CODE"),
        );
      else if (d?.error) {
        setDenied(d.error === "PERMISSION_DENIED");
        setError(
          d.error === "PERMISSION_DENIED"
            ? "Camera permission is required to scan."
            : "The camera could not open. Close other camera apps and retry.",
        );
      } else setOpen(false);
    };
    const linked = (e: Event) =>
      receivedRef.current((e as CustomEvent<string>).detail);
    window.addEventListener("taha-scan-open", start);
    window.addEventListener("taha-scan-result", scanned);
    window.addEventListener("taha-qr-value", linked);
    return () => {
      window.removeEventListener("taha-scan-open", start);
      window.removeEventListener("taha-scan-result", scanned);
      window.removeEventListener("taha-qr-value", linked);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!open || result || error || window.TahaNative?.scanQr) return;
    let active = true,
      timer: ReturnType<typeof setTimeout>;
    if (!navigator.mediaDevices) {
      setError("Camera scanning requires HTTPS or the Taha Staff Android app.");
      return;
    }
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (camera) => {
        if (!active) {
          camera.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = camera;
        if (video.current) {
          video.current.srcObject = camera;
          await video.current.play();
        }
        const canvas = document.createElement("canvas");
        const { default: jsQR } = await import("jsqr");
        const scan = async () => {
          if (!active || !video.current) return;
          const v = video.current;
          if (v.videoWidth) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            if (mode !== "barcode") {
              const pixels = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                ),
                code = jsQR(pixels.data, pixels.width, pixels.height);
              if (code) {
                receivedRef.current(code.data);
                return;
              }
            }
            if (mode !== "qr") {
              try {
                const value = await decodeBarcode(canvas);
                if (!active) return;
                if (value) {
                  receivedRef.current(value, true);
                  return;
                }
              } catch (c) {
                if (mode === "barcode") {
                  setError((c as Error).message);
                  return;
                }
              }
            }
          }
          timer = setTimeout(() => void scan(), 180);
        };
        void scan();
      })
      .catch(() => {
        setDenied(true);
        setError("Allow camera access to scan QR codes and barcodes.");
      });
    return () => {
      active = false;
      clearTimeout(timer);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [open, result, error, mode]);
  const connect = async () => {
    if (!result || !("shop" in result)) return;
    setBusy(true);
    try {
      if (!(await useShopConnectionStore.getState().connect(result.shop)))
        throw new Error("Cannot connect to this shop. Check Shop Connection.");
      go(routeQr(result));
      setOpen(false);
    } catch (c) {
      setError((c as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={result ? "Connect to Shop" : "Scan"}
      description="Products, locations, receipts and Taha QR codes"
      className={
        !result && !window.TahaNative?.scanQr ? "qr-scan-dialog" : undefined
      }
    >
      <div className="taha-scanner">
        {!result && !window.TahaNative?.scanQr && (
          <>
            <div className="qr-preview">
              <video
                ref={video}
                autoPlay
                playsInline
                muted
                aria-label="Scanner camera preview"
              />
              <div
                className={`qr-target ${mode === "barcode" ? "barcode" : "qr"}`}
              >
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="qr-controls">
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  aria-label="Back"
                >
                  <ArrowLeft />
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Flashlight"
                  onClick={() => {
                    const track = stream.current?.getVideoTracks()[0];
                    if (track)
                      void track
                        .applyConstraints({
                          advanced: [
                            { torch: !torch } as MediaTrackConstraintSet,
                          ],
                        })
                        .then(() => setTorch(!torch))
                        .catch(() =>
                          setError("Flashlight is unavailable on this camera."),
                        );
                  }}
                >
                  <Flashlight />
                </Button>
              </div>
            </div>
            <p>
              {mode === "barcode"
                ? "Align barcode inside frame"
                : mode === "qr"
                  ? "Point camera at a Taha QR code"
                  : "Point camera at a Taha QR code or product barcode"}
            </p>
            <div className="scanner-modes">
              {(["auto", "qr", "barcode"] as const).map((value) => (
                <Button
                  key={value}
                  aria-pressed={mode === value}
                  onClick={() => {
                    setError("");
                    setMode(value);
                    useMobilePreferences.setState({ scannerMode: value });
                  }}
                >
                  {value === "auto"
                    ? "Auto"
                    : value === "qr"
                      ? "QR"
                      : "Barcode"}
                </Button>
              ))}
            </div>
          </>
        )}
        {window.TahaNative?.scanQr && !result && !error && (
          <p role="status">Camera opening…</p>
        )}
        {result && "shop" in result && (
          <>
            <p>
              This code connects to {new URL(result.shop).host}. Continue only
              if this is your shop.
            </p>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void connect()}
            >
              {busy ? "Connecting…" : "Test and Connect"}
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        {denied && (
          <Button onClick={() => window.TahaNative?.openSettings?.()}>
            Open Settings
          </Button>
        )}
        <Button onClick={() => setOpen(false)}>Close</Button>
      </div>
    </Dialog>
  );
}
