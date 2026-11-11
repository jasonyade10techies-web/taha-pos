import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import "./searchable-controls.css";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  image?: ReactNode;
  disabled?: boolean;
}
export interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onCreate?: (query: string) => void | Promise<void>;
  createLabel?: string;
  clearable?: boolean;
  className?: string;
}
/** Editable search, selected value, and explicit creation are distinct states. */
export function SearchableCombobox({
  value,
  onChange,
  options,
  label,
  placeholder = "Search or select…",
  disabled,
  required,
  loading,
  error,
  onRetry,
  onCreate,
  createLabel,
  clearable = true,
  className = "",
}: SearchableComboboxProps) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null),
    root = useRef<HTMLDivElement>(null),
    popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [displayed, setDisplayed] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(-1),
    [creating, setCreating] = useState(false),
    [createError, setCreateError] = useState(""),
    [position, setPosition] = useState({
      left: 0,
      top: 0,
      width: 200,
      maxHeight: 320,
    });
  useEffect(() => {
    if (open) {
      setDisplayed(true);
      return;
    }
    const timer = setTimeout(() => setDisplayed(false), 110);
    return () => clearTimeout(timer);
  }, [open]);
  const selected = options.find((o) => o.value === value),
    normalized = query.trim().toLocaleLowerCase();
  const filtered = options.filter((o) =>
    (o.label + " " + (o.description ?? ""))
      .toLocaleLowerCase()
      .includes(normalized),
  );
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
    setActive(-1);
    input.current?.focus();
  };
  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(-1);
  };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const below = innerHeight - rect.bottom - 16,
        above = rect.top - 16;
      const maxHeight = Math.max(120, Math.min(360, Math.max(below, above)));
      setPosition({
        left: Math.max(
          8,
          Math.min(
            rect.left,
            innerWidth - Math.min(rect.width, innerWidth - 16) - 8,
          ),
        ),
        top:
          below < 200 && above > below
            ? Math.max(8, rect.top - maxHeight - 6)
            : rect.bottom + 6,
        width: Math.min(rect.width, innerWidth - 16),
        maxHeight,
      });
    };
    place();
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        close();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  useEffect(() => {
    if (active >= 0)
      popup.current
        ?.querySelector(`[data-option-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  const create = async () => {
    if (!onCreate || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      await onCreate(query.trim());
      close();
      input.current?.focus();
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : "Unable to create value.",
      );
    } finally {
      setCreating(false);
    }
  };
  return (
    <div ref={root} className={`searchable-combobox ${className}`}>
      <div className="searchable-combobox-field">
        <input
          ref={input}
          className="input"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 ? `${id}-${active}` : undefined
          }
          aria-required={required}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? value)}
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          onFocus={() => setCreateError("")}
          onBlur={(event) => {
            if (
              !popup.current?.contains(event.relatedTarget) &&
              !root.current?.contains(event.relatedTarget)
            )
              close();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((old) => {
                const direction = event.key === "ArrowDown" ? 1 : -1;
                let next = old;
                for (let i = 0; i < filtered.length; i++) {
                  next = (next + direction + filtered.length) % filtered.length;
                  if (!filtered[next]?.disabled) return next;
                }
                return -1;
              });
            } else if (event.key === "Home" && open) {
              event.preventDefault();
              setActive(filtered.findIndex((o) => !o.disabled));
            } else if (event.key === "End" && open) {
              event.preventDefault();
              let last = filtered.length - 1;
              while (last >= 0 && filtered[last].disabled) last--;
              setActive(last);
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              if (active >= 0 && filtered[active] && !filtered[active].disabled)
                choose(filtered[active].value);
            } else if (event.key === "Tab") close();
          }}
        />
        {value && clearable && !disabled && (
          <button
            type="button"
            className="searchable-clear"
            aria-label={`Clear ${label}`}
            onClick={() => choose("")}
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          className="searchable-chevron"
          aria-label={`Open ${label} options`}
          disabled={disabled}
          onClick={() => {
            setOpen((v) => !v);
            setQuery("");
            input.current?.focus();
          }}
        >
          <ChevronDown size={15} />
        </button>
      </div>
      {(open || displayed) &&
        createPortal(
          <div
            ref={popup}
            aria-hidden={!open}
            className={`searchable-popup ${open ? "" : "closing"}`}
            style={{
              position: "fixed",
              ...position,
              zIndex: 120,
              pointerEvents: open ? "auto" : "none",
            }}
            onPointerDown={(event) => event.preventDefault()}
          >
            {loading ? (
              <p role="status">Loading options…</p>
            ) : error ? (
              <div role="alert">
                {error}
                {onRetry && (
                  <button type="button" onClick={onRetry}>
                    Retry
                  </button>
                )}
              </div>
            ) : (
              <div role="listbox" id={id} aria-label={`${label} options`}>
                {filtered.length ? (
                  filtered.map((option, index) => (
                    <button
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={value === option.value}
                      aria-disabled={option.disabled}
                      disabled={option.disabled}
                      data-option-index={index}
                      id={`${id}-${index}`}
                      key={option.value}
                      className={`searchable-option ${active === index ? "active" : ""}`}
                      onPointerMove={() => setActive(index)}
                      onClick={() => choose(option.value)}
                    >
                      {option.image}
                      <span>
                        <strong>{option.label}</strong>
                        {option.description && (
                          <small>{option.description}</small>
                        )}
                      </span>
                      {value === option.value && <Check size={16} />}
                    </button>
                  ))
                ) : (
                  <p role="status">No matching {label.toLocaleLowerCase()}.</p>
                )}
              </div>
            )}
            {onCreate &&
              !loading &&
              !error &&
              (createLabel ||
                (normalized &&
                  !options.some(
                    (o) => o.label.trim().toLocaleLowerCase() === normalized,
                  ))) && (
                <button
                  type="button"
                  className="searchable-create"
                  disabled={creating}
                  onClick={() => void create()}
                >
                  <Plus size={15} />
                  {creating
                    ? "Saving…"
                    : (createLabel ?? `Create “${query.trim()}”`)}
                </button>
              )}
            {createError && <p role="alert">{createError}</p>}
          </div>,
          document.body,
        )}
    </div>
  );
}
