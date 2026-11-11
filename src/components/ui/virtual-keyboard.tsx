import { useEffect, useState, type RefObject } from "react";
import { Delete, CornerDownLeft, Keyboard as KeyboardIcon, X } from "lucide-react";
import { useKeyboardStore } from "../../stores/keyboard-store";
import { useUiStore } from "../../stores/ui-store";

const numberKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];
const fullRows = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
type Target = HTMLInputElement | HTMLTextAreaElement;
let focusedTarget: Target | null = null;
const numericDrafts = new WeakMap<Target, { raw: string; committed: string }>();
function writable(element: EventTarget | null): element is Target {
  return (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && !element.disabled && !element.readOnly && !(element instanceof HTMLInputElement && ["file", "checkbox", "radio"].includes(element.type));
}
function write(target: Target, key: string) {
  if (target instanceof HTMLInputElement && target.type === "number") {
    const previous = numericDrafts.get(target);
    const raw = previous?.committed === target.value ? previous.raw : target.value;
    const next = key === "Clear" ? "" : key === "⌫" ? raw.slice(0, -1) : raw + key;
    if (!/^\d*(\.\d*)?$/.test(next)) return;
    const committed = String(Number(next || "0"));
    numericDrafts.set(target, { raw: next, committed });
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(target, committed);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.focus();
    return;
  }
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  const next = key === "Clear" ? "" : key === "⌫" ? target.value.slice(0, start === end ? Math.max(0, start - 1) : start) + target.value.slice(end) : target.value.slice(0, start) + key + target.value.slice(end);
  const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(target, next);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.focus();
  if (["text", "search", "tel", "password", "url"].includes(target.type) || target instanceof HTMLTextAreaElement) {
    const caret = key === "⌫" ? Math.max(0, start - 1) : key === "Clear" ? 0 : start + key.length;
    target.setSelectionRange(caret, caret);
  }
}

export function VirtualKeyboardHost({ inDialog = false, owner }: { inDialog?: boolean;owner?:RefObject<HTMLDivElement|null> }) {
  const { open, mode, setOpen, modalDepth } = useKeyboardStore();
  const size = useUiStore(s=>s.keyboardSize);
  const enabled = useUiStore((s) => s.keyboardEnabled);
  const numericAmounts = useUiStore(s => s.keyboardNumericAmounts), autoTouch = useUiStore(s => s.keyboardOpenOnTouch);
  const [field, setField] = useState("");
  const [shift, setShift] = useState(false);
  const [ownsTarget,setOwnsTarget] = useState(!inDialog);
  useEffect(() => {
    const focus = (event: FocusEvent) => {
      if (!writable(event.target)) return;
      focusedTarget = event.target;
      setOwnsTarget(!inDialog || event.target.closest('.dialog-frame')===owner?.current);
      const label = event.target.labels?.[0]?.textContent?.trim() || event.target.getAttribute("aria-label") || event.target.placeholder || "Selected field";
      setField(label);
      const numeric = numericAmounts && (event.target.type === "number" || ["numeric", "decimal", "tel"].includes(event.target.inputMode));
      const current = useKeyboardStore.getState();
      setOpen(current.open, numeric ? "numeric" : "full");
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onTouch = (event: PointerEvent) => { if(autoTouch && event.pointerType==="touch" && window.innerWidth>=768 && writable(event.target))setOpen(true); };
    document.addEventListener("focusin", focus);
    if (writable(document.activeElement)) focus({target:document.activeElement} as unknown as FocusEvent);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown",onTouch);
    return () => { document.removeEventListener("focusin", focus); window.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown",onTouch); };
  }, [setOpen,numericAmounts,autoTouch,inDialog,owner]);
  useEffect(() => {
    if (inDialog) return;
    document.documentElement.classList.toggle("touch-keyboard-open", enabled && open && modalDepth === 0);
    return () => document.documentElement.classList.remove("touch-keyboard-open");
  }, [enabled, open, modalDepth, inDialog]);
  if (!enabled || !open || (!inDialog && modalDepth > 0) || (inDialog && (modalDepth === 0 || !ownsTarget))) return null;
  const press = (key: string) => {
    if (key === "⇧") return setShift((s) => !s);
    if (!focusedTarget || !document.contains(focusedTarget)) return;
    if (key === "Enter") { focusedTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); setOpen(false); return; }
    write(focusedTarget, shift && key.length === 1 ? key.toUpperCase() : key);
    if (shift) setShift(false);
  };
  const keyButton = (key: string) => <button type="button" key={key} aria-label={key === "⌫" ? "Backspace" : key === " " ? "Space" : key} onPointerDown={(e) => e.preventDefault()} onClick={() => press(key)}>{key === "⌫" ? <Delete size={20} /> : key === "Enter" ? <><CornerDownLeft size={18} />Enter</> : key === " " ? "Space" : shift ? key.toUpperCase() : key}</button>;
  return <section className={`virtual-keyboard keyboard-size-${size.toLowerCase()} ${inDialog ? "virtual-keyboard-modal" : ""}`} aria-label="On-screen keyboard" onPointerDown={(e) => e.preventDefault()}><div className="virtual-keyboard-heading"><span><KeyboardIcon size={17} />{mode === "numeric" ? "NUMERIC KEYPAD" : "FULL KEYBOARD"} · {field || "Focus a field to type"}</span><button type="button" onClick={() => setOpen(false)} aria-label="Close keyboard"><X size={18} /></button></div>{mode === "numeric" ? <div className="numpad-grid">{numberKeys.map(keyButton)}{keyButton("Clear")}{keyButton("Enter")}</div> : <div className="keyboard-rows">{fullRows.map((row) => <div className="keyboard-row" key={row}>{[...row].map(keyButton)}</div>)}<div className="keyboard-row keyboard-last-row">{["⇧", "⌫", " ", "@", ".", "Enter"].map(keyButton)}</div></div>}</section>;
}
