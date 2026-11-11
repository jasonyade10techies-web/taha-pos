import { useRef, useState, type ReactNode } from "react";
import {
  Camera,
  ArrowLeft,
  ArrowRight,
  Crop,
  ImagePlus,
  Star,
  Trash2,
  Replace,
  ZoomIn,
  ZoomOut,
  GripVertical,
} from "lucide-react";
import { prepareImage } from "../../lib/media";
import { rememberOriginal } from "../../lib/image-edits";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { MediaImage } from "./media-image";
import { CropEditor } from "./crop-editor";
const originalData = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read this photo."));
    r.readAsDataURL(file);
  });
export function MediaUploader({
  values,
  onChange,
  label = "Upload Images",
  multiple = false,
  evidence = false,
  onBusyChange,
  phoneAction,
}: {
  values: string[];
  onChange: (images: string[]) => void;
  label?: string;
  multiple?: boolean;
  evidence?: boolean;
  onBusyChange?: (busy: boolean) => void;
  phoneAction?: ReactNode;
}) {
  const camera = useRef<HTMLInputElement>(null),
    browse = useRef<HTMLInputElement>(null),
    replace = useRef<number | null>(null),
    dragged = useRef<number | null>(null),
    swipe = useRef(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<number | null>(null),
    [crop, setCrop] = useState<number | null>(null),
    [zoom, setZoom] = useState(1);
  const read = async (files: File[]) => {
    if (busy || !files.length) return;
    setBusy(true);
    setError("");
    onBusyChange?.(true);
    try {
      const selected =
        multiple && replace.current === null ? files : files.slice(0, 1);
      if (
        multiple &&
        replace.current === null &&
        values.length + selected.length > 12
      )
        throw new Error(
          "You can attach up to 12 images. Remove an image before adding another.",
        );
      const images: string[] = [];
      for (let i = 0; i < selected.length; i += 2) {
        images.push(
          ...(await Promise.all(
            selected.slice(i, i + 2).map(async (f) => {
              const image = await prepareImage(f, { evidence });
              if (!evidence) rememberOriginal(image, await originalData(f));
              return image;
            }),
          )),
        );
      }
      if (replace.current !== null) {
        const copy = [...values];
        copy[replace.current] = images[0];
        onChange(copy);
        replace.current = null;
      } else onChange(multiple ? [...values, ...images] : images);
    } catch (c) {
      setError(
        c instanceof Error ? c.message : "This image could not be loaded.",
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= values.length) return;
    const copy = [...values],
      item = copy.splice(from, 1)[0];
    copy.splice(to, 0, item);
    onChange(copy);
  };
  return (
    <section
      className="media-uploader"
      aria-busy={busy}
      onPaste={(e) => {
        const files = [...e.clipboardData.items]
          .map((i) => i.getAsFile())
          .filter((f): f is File => !!f);
        if (files.length) {
          e.preventDefault();
          void read(files);
        }
      }}
    >
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Take gallery photo"
        onChange={(e) => {
          void read([...(e.target.files || [])]);
          e.target.value = "";
        }}
      />
      <input
        ref={browse}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple && replace.current === null}
        aria-label={label}
        onChange={(e) => {
          void read([...(e.target.files || [])]);
          e.target.value = "";
        }}
      />
      <div className="image-gallery-header">
        <h3>{multiple ? "Product Images" : "Image"}</h3>
        <span className="text-xs text-muted">
          {values.length}
          {multiple ? " / 12" : ""}
        </span>
      </div>
      <div className="image-gallery-actions">
        {phoneAction || (
          <Button
            className="gallery-phone-action"
            disabled={busy}
            onClick={() => {
              replace.current = null;
              camera.current?.click();
            }}
          >
            <Camera size={20} />
            <span>
              Take Photo on This Device<small>Use this device camera</small>
            </span>
          </Button>
        )}
        <Button
          disabled={busy}
          onClick={() => {
            replace.current = null;
            browse.current?.click();
          }}
        >
          <ImagePlus size={18} />
          {label}
        </Button>
      </div>
      <div
        className="media-preview-grid"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void read([...e.dataTransfer.files]);
        }}
      >
        {values.map((image, index) => (
          <article
            key={image + index}
            className="media-preview"
            draggable={multiple}
            onDragStart={(e) => {
              dragged.current = index;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragged.current !== null) {
                move(dragged.current, index);
                dragged.current = null;
              }
            }}
          >
            {index === 0 && multiple && (
              <span className="gallery-primary">PRIMARY</span>
            )}
            <button
              className="media-preview-image"
              aria-label={`Preview image ${index + 1}`}
              onClick={() => {
                setZoom(1);
                setPreview(index);
              }}
            >
              <MediaImage
                thumbnail
                src={image}
                alt={`Selected image ${index + 1}`}
                loading="lazy"
              />
            </button>
            <div className="gallery-controls">
              <Button
                variant="ghost"
                aria-label={`Move image ${index + 1} left`}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <GripVertical size={16} />
                <ArrowLeft size={12} />
              </Button>
              {!evidence && (
                <Button
                  variant="ghost"
                  aria-label={`Crop image ${index + 1}`}
                  onClick={() => setCrop(index)}
                >
                  <Crop size={16} />
                </Button>
              )}
              {multiple && (
                <Button
                  variant="ghost"
                  aria-label={`Make image ${index + 1} primary`}
                  onClick={() => move(index, 0)}
                >
                  <Star
                    size={16}
                    fill={index === 0 ? "currentColor" : "none"}
                  />
                </Button>
              )}
              <Button
                variant="ghost"
                aria-label={`Replace image ${index + 1}`}
                onClick={() => {
                  replace.current = index;
                  browse.current?.click();
                }}
              >
                <Replace size={16} />
              </Button>
              <Button
                variant="ghost"
                aria-label={
                  multiple ? `Remove image ${index + 1}` : "Remove image"
                }
                onClick={() => onChange(values.filter((_, i) => i !== index))}
              >
                <Trash2 size={16} />
              </Button>
              <Button
                variant="ghost"
                aria-label={`Move image ${index + 1} right`}
                disabled={index === values.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowRight size={16} />
              </Button>
            </div>
          </article>
        ))}
        {multiple && (
          <button
            className="media-preview-image media-preview panel"
            onClick={() => {
              replace.current = null;
              browse.current?.click();
            }}
            aria-label="Add images"
          >
            <ImagePlus />
            <span>Add Images</span>
          </button>
        )}
      </div>
      {busy && <p role="status">Preparing photos…</p>}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title="Image Preview"
      >
        <div
          className="image-viewer-stage"
          onTouchStart={(e) => {
            swipe.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const delta = e.changedTouches[0].clientX - swipe.current;
            if (Math.abs(delta) > 60 && preview !== null) {
              setPreview(
                (preview + (delta < 0 ? 1 : -1) + values.length) %
                  values.length,
              );
              setZoom(1);
            }
          }}
        >
          {preview !== null && (
            <MediaImage
              src={values[preview]}
              alt={`Image ${preview + 1} of ${values.length}`}
              style={{ transform: `scale(${zoom})` }}
            />
          )}
        </div>
        <div className="image-viewer-controls">
          <Button
            aria-label="Previous image"
            onClick={() => {
              setPreview(((preview || 0) - 1 + values.length) % values.length);
              setZoom(1);
            }}
          >
            <ArrowLeft size={18} />
          </Button>
          <span>
            {(preview || 0) + 1} / {values.length}
          </span>
          <Button
            aria-label="Next image"
            onClick={() => {
              setPreview(((preview || 0) + 1) % values.length);
              setZoom(1);
            }}
          >
            <ArrowRight size={18} />
          </Button>
          <Button
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          >
            <ZoomIn size={18} />
          </Button>
          <Button
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(1, zoom - 0.25))}
          >
            <ZoomOut size={18} />
          </Button>
        </div>
      </Dialog>
      <CropEditor
        image={crop === null ? null : values[crop]}
        onClose={() => setCrop(null)}
        onApply={(url) => {
          const copy = [...values];
          if (crop !== null) copy[crop] = url;
          onChange(copy);
        }}
      />
    </section>
  );
}
