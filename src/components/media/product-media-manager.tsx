import { useRef, useState, type ReactNode } from "react";
import {
  Camera,
  Upload,
  Plus,
  Crop,
  Trash2,
  Star,
  Download,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  GripVertical,
  LoaderCircle,
  X,
} from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { MediaImage as ImageRecord } from "../../types/demo";
import { shopFetch } from "../../lib/mobile/transport";
import { imageDataBlob, prepareImage } from "../../lib/media";
import { imageEdit, rememberOriginal } from "../../lib/image-edits";
import { mapLimit } from "../../lib/photo-quality";
import { toast } from "../../stores/toast-store";
import { Button } from "../ui/button";
import { AppCheckbox } from "../ui/app-checkbox";
import { Dialog } from "../ui/dialog";
import { MediaImage } from "./media-image";
import { CropEditor } from "./crop-editor";
const imageKey = (image: ImageRecord, index: number) =>
  image.id ?? image.path ?? `${index}:${image.url}`;
type Preparation = {
  id: string;
  file: File;
  status: "Queued" | "Processing" | "Failed";
  error?: string;
};
const original = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(file);
  });
export function ProductMediaManager({
  images,
  onChange,
  phoneAction,
  onBusyChange,
  useDeviceCamera = false,
}: {
  images: ImageRecord[];
  onChange: (images: ImageRecord[]) => void;
  phoneAction?: ReactNode;
  useDeviceCamera?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const deviceCamera = useRef<HTMLInputElement>(null),
    browse = useRef<HTMLInputElement>(null),
    latest = useRef(images),
    drag = useRef<number | null>(null),
    swipe = useRef(0),
    processing = useRef(false);
  latest.current = images;
  const [jobs, setJobs] = useState<Preparation[]>([]),
    [selection, setSelection] = useState<string[]>([]),
    [expanded, setExpanded] = useState(false),
    [viewer, setViewer] = useState<number | null>(null),
    [crop, setCrop] = useState<number | null>(null),
    [zoom, setZoom] = useState(1);
  const change = (next: ImageRecord[]) => {
    latest.current = next;
    onChange(next);
  };
  const process = async (items: Preparation[]) => {
    if (processing.current) return;
    processing.current = true;
    onBusyChange?.(true);
    try {
      await mapLimit(items, 2, async (job) => {
        setJobs((old) =>
          old.map((item) =>
            item.id === job.id
              ? { ...item, status: "Processing", error: undefined }
              : item,
          ),
        );
        try {
          const url = await prepareImage(job.file);
          rememberOriginal(url, await original(job.file));
          change([...latest.current, { id: job.id, url, ...imageEdit(url) }]);
          setJobs((old) => old.filter((item) => item.id !== job.id));
        } catch (error) {
          setJobs((old) =>
            old.map((item) =>
              item.id === job.id
                ? {
                    ...item,
                    status: "Failed",
                    error:
                      error instanceof Error
                        ? error.message
                        : "Could not prepare this photo.",
                  }
                : item,
            ),
          );
        }
      });
    } finally {
      processing.current = false;
      onBusyChange?.(false);
    }
  };
  const read = (files: File[]) => {
    if (!files.length || processing.current) return;
    if (latest.current.length + jobs.length + files.length > 12) {
      toast("You can add up to 12 product images.", "warning");
      return;
    }
    const next = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "Queued" as const,
    }));
    setJobs((old) => [...old, ...next]);
    void process(next);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images],
      item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    change(next);
  };
  const download = async (index: number) => {
    const image = document.querySelector<HTMLImageElement>(
      `[data-product-media="${index}"] img`,
    );
    if (!image?.src) return;
    try {
      const response = image.src.startsWith("data:")
        ? new Response(imageDataBlob(image.src))
        : await shopFetch(image.src.replace(/([?&])thumbnail=1(&|$)/, "$1"));
      if (!response.ok)
        throw new Error(
          "Could not download this photo. Refresh and try again.",
        );
      const blob = await response.blob();
      if (window.TahaNative?.saveToGallery) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not save photo."));
          reader.readAsDataURL(blob);
        });
        if (!window.TahaNative.saveToGallery(data))
          throw new Error("Could not save photo to gallery.");
        toast("Photo saved to gallery");
        return;
      }
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Taha-product-${index + 1}.${blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not download photo.",
        "error",
      );
    }
  };
  const one =
    selection.length === 1
      ? images.findIndex(
          (image, index) => imageKey(image, index) === selection[0],
        )
      : -1;
  const visible = expanded ? images : images.slice(0, 6),
    busy = jobs.some((job) => job.status !== "Failed");
  const photoAction = useDeviceCamera ? (
    <Button
      size="small"
      disabled={busy}
      onClick={() => deviceCamera.current?.click()}
    >
      <Camera size={15} />
      Take Photo
    </Button>
  ) : (
    phoneAction
  );
  const upload = (
    <Button
      size="small"
      disabled={busy || images.length + jobs.length >= 12}
      onClick={() => browse.current?.click()}
    >
      <Upload size={15} />
      Upload
    </Button>
  );
  return (
    <section
      className="product-media-manager"
      aria-label="Product media"
      aria-busy={busy}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (event.dataTransfer.files.length)
          read([...event.dataTransfer.files]);
      }}
      onPaste={(event) => {
        const files = [...event.clipboardData.items]
          .map((item) => item.getAsFile())
          .filter((file): file is File => !!file);
        if (files.length) {
          event.preventDefault();
          read(files);
        }
      }}
    >
      {useDeviceCamera && (
        <input
          hidden
          ref={deviceCamera}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          aria-label="Take product photo"
          onChange={(event) => {
            read([...(event.target.files || [])]);
            event.target.value = "";
          }}
        />
      )}
      <input
        hidden
        ref={browse}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-label="Upload product images"
        onChange={(event) => {
          read([...(event.target.files || [])]);
          event.target.value = "";
        }}
      />
      <div className="product-media-heading">
        <div>
          <h2>Media</h2>
          <span>{images.length} / 12</span>
        </div>
        <div>
          {photoAction}
          {upload}
        </div>
      </div>
      {selection.length > 0 && (
        <div className="media-selection-toolbar">
          <strong>{selection.length} selected</strong>
          <Button
            size="small"
            disabled={one < 0}
            onClick={() => {
              move(one, 0);
              setSelection([]);
            }}
          >
            <Star size={14} />
            Set Primary
          </Button>
          <Button size="small" disabled={one < 0} onClick={() => setCrop(one)}>
            <Crop size={14} />
            Crop
          </Button>
          <Button
            size="small"
            onClick={() => {
              change(
                images.filter(
                  (image, index) => !selection.includes(imageKey(image, index)),
                ),
              );
              setSelection([]);
            }}
          >
            <Trash2 size={14} />
            Delete
          </Button>
          <Button
            size="small"
            onClick={() =>
              images.forEach((image, index) => {
                if (selection.includes(imageKey(image, index))) download(index);
              })
            }
          >
            <Download size={14} />
            Download
          </Button>
          <Button size="small" variant="ghost" onClick={() => setSelection([])}>
            Clear Selection
          </Button>
        </div>
      )}
      {!images.length && !jobs.length ? (
        <div className="product-media-empty">
          <div className="media-empty-icon">
            <Plus size={24} />
          </div>
          <strong>Add product media</strong>
          <div>
            <Button size="small" onClick={() => browse.current?.click()}>
              Upload from Computer
            </Button>
            {photoAction}
          </div>
          <small>Images can also be captured from a paired staff phone.</small>
        </div>
      ) : (
        <div className="product-media-grid">
          {visible.map((image, index) => (
            <article
              key={imageKey(image, index)}
              className={`product-media-tile ${index === 0 ? "primary-tile" : ""} ${selection.includes(imageKey(image, index)) ? "selected" : ""}`}
              data-product-media={index}
              draggable
              onDragStart={(event) => {
                drag.current = index;
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                if (drag.current !== null) {
                  event.preventDefault();
                  event.stopPropagation();
                  move(drag.current, index);
                  drag.current = null;
                }
              }}
            >
              <AppCheckbox
                aria-label={`Select image ${index + 1}`}
                checked={selection.includes(imageKey(image, index))}
                onChange={(event) => {
                  const checked = event.target.checked,
                    key = imageKey(image, index);
                  setSelection((old) =>
                    checked
                      ? [...old, key]
                      : old.filter((value) => value !== key),
                  );
                }}
              />
              <button
                type="button"
                className="product-media-open"
                aria-label={`Preview image ${index + 1}`}
                onClick={() => {
                  setViewer(index);
                  setZoom(1);
                }}
              >
                <MediaImage
                  thumbnail
                  src={image.url}
                  alt={`Product image ${index + 1}`}
                />
              </button>
              {index === 0 && (
                <span className="media-primary-badge">Primary</span>
              )}
              <span className="media-drag-handle" aria-hidden="true">
                <GripVertical size={15} />
              </span>
              <div className="media-reorder">
                <button
                  type="button"
                  aria-label={`Move image ${index + 1} left`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowLeft size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Move image ${index + 1} right`}
                  disabled={index === images.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowRight size={13} />
                </button>
              </div>
            </article>
          ))}
          {!expanded && images.length > 6 && (
            <button
              type="button"
              className="product-media-more"
              onClick={() => setExpanded(true)}
            >
              +{images.length - 6}
              <small>View all media</small>
            </button>
          )}
          {jobs.map((job) => (
            <div
              className="product-media-processing"
              key={job.id}
              role={job.status === "Failed" ? "alert" : "status"}
            >
              {job.status === "Failed" ? (
                <>
                  <strong>Photo failed</strong>
                  <small>{job.error}</small>
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={() => void process([job])}
                  >
                    Retry
                  </Button>
                  <button
                    type="button"
                    aria-label="Remove failed photo"
                    onClick={() =>
                      setJobs((old) => old.filter((item) => item.id !== job.id))
                    }
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle size={22} className="media-spinner" />
                  <strong>
                    {job.status === "Queued" ? "Queued" : "Processing…"}
                  </strong>
                  <small>{job.file.name}</small>
                </>
              )}
            </div>
          ))}
          {images.length + jobs.length < 12 && (
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <button
                  type="button"
                  className="product-media-add"
                  aria-label="Add product media"
                >
                  <Plus size={25} />
                  <span>Add</span>
                </button>
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content
                  className="app-select-menu media-add-menu"
                  sideOffset={6}
                >
                  <div>{photoAction}</div>
                  <Dropdown.Item
                    className="app-select-option"
                    onSelect={() => browse.current?.click()}
                  >
                    Upload from Computer
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          )}
        </div>
      )}
      {expanded && images.length > 6 && (
        <Button variant="ghost" size="small" onClick={() => setExpanded(false)}>
          Show less
        </Button>
      )}
      <Dialog
        open={viewer !== null}
        title="Product Media"
        onOpenChange={(open) => {
          if (!open) setViewer(null);
        }}
        className="media-viewer-dialog"
      >
        <div
          className="image-viewer-stage"
          onTouchStart={(event) => (swipe.current = event.touches[0].clientX)}
          onTouchEnd={(event) => {
            const delta = event.changedTouches[0].clientX - swipe.current;
            if (Math.abs(delta) > 60)
              setViewer(
                ((viewer ?? 0) + (delta < 0 ? 1 : -1) + images.length) %
                  images.length,
              );
          }}
        >
          {viewer !== null && images[viewer] && (
            <MediaImage
              src={images[viewer].url}
              alt={`Image ${viewer + 1} of ${images.length}`}
              style={{ transform: `scale(${zoom})` }}
            />
          )}
        </div>
        <div className="image-viewer-controls">
          <Button
            aria-label="Previous image"
            onClick={() => {
              setViewer(((viewer ?? 0) - 1 + images.length) % images.length);
              setZoom(1);
            }}
          >
            <ArrowLeft size={17} />
          </Button>
          <span>
            {(viewer ?? 0) + 1} / {images.length}
          </span>
          <Button
            aria-label="Next image"
            onClick={() => {
              setViewer(((viewer ?? 0) + 1) % images.length);
              setZoom(1);
            }}
          >
            <ArrowRight size={17} />
          </Button>
          <Button
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          >
            <ZoomIn size={17} />
          </Button>
          <Button
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(1, zoom - 0.25))}
          >
            <ZoomOut size={17} />
          </Button>
        </div>
        <div className="dialog-actions">
          <Button
            onClick={() => {
              setCrop(viewer);
              setViewer(null);
            }}
          >
            <Crop size={16} />
            Crop
          </Button>
          <Button
            onClick={() => {
              move(viewer ?? 0, 0);
              setViewer(0);
            }}
          >
            <Star size={16} />
            Set Primary
          </Button>
          <Button onClick={() => download(viewer ?? 0)}>
            <Download size={16} />
            Download
          </Button>
          <Button
            onClick={() => {
              change(images.filter((_, index) => index !== viewer));
              setViewer(null);
            }}
          >
            <Trash2 size={16} />
            Delete
          </Button>
        </div>
      </Dialog>
      <CropEditor
        image={crop === null ? null : (images[crop]?.url ?? null)}
        onClose={() => setCrop(null)}
        onApply={(url) => {
          if (crop === null) return;
          const next = [...images];
          next[crop] = { id: next[crop].id, url, ...imageEdit(url) };
          change(next);
          setSelection([]);
        }}
      />
    </section>
  );
}
