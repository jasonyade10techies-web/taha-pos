import { useToasts } from "../../stores/toast-store";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
export function NotificationToastHost() {
  const { items, remove } = useToasts();
  return (
    <div className="toast-host" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className={`toast toast-${t.tone}`}
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
          >
            {t.tone === "success" ? (
              <CheckCircle2 size={19} />
            ) : t.tone === "error" ? (
              <AlertCircle size={19} />
            ) : (
              <Info size={19} />
            )}
            <span className="toast-text">
              <strong>
                {t.title ??
                  (t.tone === "success"
                    ? "Done"
                    : t.tone === "error"
                      ? "Could not complete action"
                      : t.tone === "warning"
                        ? "Attention"
                        : "Update")}
              </strong>
              {t.title !== t.message && <small>{t.message}</small>}
            </span>
            <button
              aria-label="Dismiss notification"
              onClick={() => remove(t.id)}
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export const ToastHost = NotificationToastHost;
