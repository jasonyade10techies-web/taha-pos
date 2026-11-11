import { Info } from "lucide-react";
import { useId, useState } from "react";

export function InfoTooltip({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="info-tooltip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(!open)} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}><Info size={14} aria-hidden="true" /></button>
      {open && <span className="info-tooltip-content" role="tooltip" id={id}>{label}</span>}
    </span>
  );
}
