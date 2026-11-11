import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "../../lib/utils";
import { useKeyboardStore } from "../../stores/keyboard-store";
import { VirtualKeyboardHost } from "./virtual-keyboard";

// Nested media sheets must remain above their parent sheet and its overlay.
const DialogDepth = createContext(0);

export function Dialog({
  open,
  onOpenChange,
  title,
  description = "",
  children,
  className,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  onCloseAutoFocus?: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const depth = useContext(DialogDepth);
  useEffect(() => {
    if (!open) return;
    useKeyboardStore.getState().enterModal();
    return () => useKeyboardStore.getState().leaveModal();
  }, [open]);
  return (
    <DialogDepth.Provider value={depth + 1}>
      <Primitive.Root open={open} onOpenChange={onOpenChange}>
        <Primitive.Portal>
          <Primitive.Overlay
            className="dialog-overlay"
            style={{ zIndex: 50 + depth * 20 }}
          />
          <Primitive.Content
            ref={content}
            style={{ zIndex: 51 + depth * 20 }}
            className={cn("dialog-content dialog-frame", className)}
            onCloseAutoFocus={(event) => {
              if (onCloseAutoFocus) {
                event.preventDefault();
                onCloseAutoFocus();
              }
            }}
            onEscapeKeyDown={(e) => {
              if (useKeyboardStore.getState().open) {
                e.preventDefault();
                useKeyboardStore.getState().setOpen(false);
              }
            }}
            onInteractOutside={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest(".virtual-keyboard, .searchable-popup")
              )
                event.preventDefault();
            }}
            onOpenAutoFocus={(event) => {
              const input = content.current?.querySelector<HTMLInputElement>(
                "input:not([disabled])",
              );
              if (input) {
                event.preventDefault();
                input.focus();
              }
            }}
          >
            <div className="dialog-scroll-content">
              <div className="dialog-heading">
                <div>
                  <Primitive.Title className="text-lg font-bold">
                    {title}
                  </Primitive.Title>
                  <Primitive.Description className="mt-1 text-sm text-muted">
                    {description}
                  </Primitive.Description>
                </div>
                <Primitive.Close
                  className="button button-ghost button-icon"
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </Primitive.Close>
              </div>
              {children}
            </div>
            <VirtualKeyboardHost inDialog owner={content} />
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </DialogDepth.Provider>
  );
}
