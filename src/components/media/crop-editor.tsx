import { useEffect, useRef, useState } from "react";
import { RotateCw, RotateCcw, ZoomIn } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { SheetSelect } from "../ui/sheet-select";
import { imageEdit, rememberEdit, type Crop } from "../../lib/image-edits";
import { bridgeRequest } from "../../lib/device-bridge/client";
import { bridgeStorePath } from "../../lib/device-bridge/service";
import { shopFetch } from "../../lib/mobile/transport";
export function CropEditor({
  image,
  onApply,
  onClose,
}: {
  image: string | null;
  onApply: (url: string) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState(""),
    [rotation, setRotation] = useState(0),
    [zoom, setZoom] = useState(1),
    [ratio, setRatio] = useState("1"),
    [freeAspect, setFreeAspect] = useState(1),
    [frameSize, setFrameSize] = useState({ w: 300, h: 300 }),
    [offset, setOffset] = useState({ x: 0, y: 0 }),
    [size, setSize] = useState({ w: 1, h: 1 }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
      null,
    ),
    original = useRef("");
  useEffect(() => {
    let active = true;
    setRotation(0);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError("");
    setSource("");
    if (!image) return;
    const load = async () => {
      let root = imageEdit(image)?.originalUrl || image;
      original.current = root;
      if (root.startsWith("taha-media:")) {
        const path = root.slice(11),
          urls = await bridgeRequest<Record<string, string>>(
            bridgeStorePath() + "/media/urls",
            { method: "POST", body: JSON.stringify({ paths: [path] }) },
          );
        root = urls[path];
      }
      if (root.startsWith("http")) {
        const response = await shopFetch(
          root + (root.includes("?") ? "&" : "?") + "original=1",
        );
        if (!response.ok)
          throw new Error("Reconnect to load the original image.");
        root = await new Promise<string>((resolve, reject) => {
          void response
            .blob()
            .then((blob) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () =>
                reject(new Error("Could not load the original image."));
              reader.readAsDataURL(blob);
            })
            .catch(reject);
        });
      }
      const img = new Image();
      img.src = root;
      await img.decode();
      if (active) {
        setSource(root);
        setSize({ w: img.naturalWidth, h: img.naturalHeight });
        setFreeAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    void load().catch((c) => setError(c.message));
    return () => {
      active = false;
    };
  }, [image]);
  useEffect(() => {
    if (!image) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setFrameSize({ w: rect.width, h: rect.height });
    });
    const timer = setTimeout(() => {
      if (frame.current) observer.observe(frame.current);
    }, 0);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [image]);
  const aspect = ratio === "free" ? freeAspect : Number(ratio),
    rotated = rotation % 180 !== 0 ? { w: size.h, h: size.w } : size;
  const apply = async () => {
    if (!image || !frame.current) return;
    setBusy(true);
    setError("");
    try {
      const img = new Image();
      img.src = source;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = rotated.w;
      canvas.height = rotated.h;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -size.w / 2, -size.h / 2);
      const { width: fw, height: fh } = frame.current.getBoundingClientRect(),
        scale = Math.max(fw / rotated.w, fh / rotated.h) * zoom;
      const w = Math.min(rotated.w, fw / scale),
        h = Math.min(rotated.h, fh / scale),
        x = Math.max(
          0,
          Math.min(rotated.w - w, (rotated.w - w) / 2 - offset.x / scale),
        ),
        y = Math.max(
          0,
          Math.min(rotated.h - h, (rotated.h - h) / 2 - offset.y / scale),
        );
      const crop: Crop = {
        x: x / rotated.w,
        y: y / rotated.h,
        width: w / rotated.w,
        height: h / rotated.h,
        rotation,
      };
      let result: string;
      if (original.current.startsWith("taha-media:")) {
        const stored = await bridgeRequest<{ path: string }>(
          bridgeStorePath() + "/media/crop",
          {
            method: "POST",
            body: JSON.stringify({ path: original.current.slice(11), crop }),
          },
        );
        result = "taha-media:" + stored.path;
      } else {
        const output = document.createElement("canvas"),
          edge = Math.min(1800, Math.max(w, h));
        output.width = Math.round((w * edge) / Math.max(w, h));
        output.height = Math.round((h * edge) / Math.max(w, h));
        output
          .getContext("2d")!
          .drawImage(canvas, x, y, w, h, 0, 0, output.width, output.height);
        result = output.toDataURL("image/jpeg", 0.9);
      }
      rememberEdit(result, { originalUrl: original.current, crop });
      onApply(result);
      onClose();
    } catch (c) {
      setError(c instanceof Error ? c.message : "Unable to crop this image.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!image}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Crop Image"
      description="Edit from the original. Drag to reposition, then adjust zoom."
      className="crop-dialog"
    >
      <div className="crop-workspace">
        <div
          ref={frame}
          className="crop-frame"
          style={{ aspectRatio: aspect }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              ox: offset.x,
              oy: offset.y,
            };
          }}
          onPointerMove={(e) => {
            if (drag.current) {
              const rect = e.currentTarget.getBoundingClientRect(),
                scale =
                  Math.max(rect.width / rotated.w, rect.height / rotated.h) *
                  zoom,
                maxX = Math.max(0, (rotated.w * scale - rect.width) / 2),
                maxY = Math.max(0, (rotated.h * scale - rect.height) / 2);
              setOffset({
                x: Math.max(
                  -maxX,
                  Math.min(maxX, drag.current.ox + e.clientX - drag.current.x),
                ),
                y: Math.max(
                  -maxY,
                  Math.min(maxY, drag.current.oy + e.clientY - drag.current.y),
                ),
              });
            }
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {source && (
            <img
              src={source}
              alt="Crop source"
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width:
                  size.w *
                  Math.max(frameSize.w / rotated.w, frameSize.h / rotated.h) *
                  zoom,
                height:
                  size.h *
                  Math.max(frameSize.w / rotated.w, frameSize.h / rotated.h) *
                  zoom,
                maxWidth: "none",
                objectFit: "fill",
                transform: `translate(-50%,-50%) translate(${offset.x}px,${offset.y}px) rotate(${rotation}deg)`,
              }}
            />
          )}
          <div className="crop-grid" />
        </div>
      </div>
      <div className="crop-tools">
        <SheetSelect
          label="Aspect ratio"
          value={ratio}
          options={[
            { value: "free", label: "Free" },
            { value: "1", label: "1:1" },
            { value: ".8", label: "4:5" },
            { value: ".75", label: "3:4" },
            { value: String(16 / 9), label: "16:9" },
          ]}
          onChange={(v) => {
            setRatio(v);
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
        />
        {ratio === "free" && (
          <label>
            Crop shape
            <input
              type="range"
              min=".4"
              max="2.5"
              step=".05"
              aria-label="Free crop aspect"
              value={freeAspect}
              onChange={(e) => {
                setFreeAspect(Number(e.target.value));
                setOffset({ x: 0, y: 0 });
              }}
            />
          </label>
        )}
        <label>
          <ZoomIn size={18} />
          <input
            type="range"
            min="1"
            max="3"
            step=".05"
            value={zoom}
            aria-label="Image zoom"
            onChange={(e) => {
              setZoom(Number(e.target.value));
              setOffset({ x: 0, y: 0 });
            }}
          />
        </label>
        <Button
          aria-label="Rotate image"
          onClick={() => {
            setRotation((rotation + 90) % 360);
            setOffset({ x: 0, y: 0 });
          }}
        >
          <RotateCw size={18} />
        </Button>
        <Button
          onClick={() => {
            setRotation(0);
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={16} />
          Reset
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy || !source}
          onClick={() => void apply()}
        >
          {busy ? "Applying…" : "Apply Crop"}
        </Button>
      </div>
    </Dialog>
  );
}
