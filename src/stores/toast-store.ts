import { create } from "zustand";
type Toast = {
  id: string;
  message: string;
  title?: string;
  createdAt?: string;
  tone: "success" | "warning" | "error" | "info";
};
export const useToasts = create<{
  items: Toast[];
  add: (toast: Toast) => void;
  remove: (id: string) => void;
  history: Toast[];
}>((set) => ({
  items: [],
  history: [],
  add: (toast) => set((s) => ({ items: [...s.items.slice(-2), toast],history:[toast,...s.history].slice(0,30) })),
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));
export function toast(message: string, tone: Toast["tone"] = "success", title?:string) {
  if(tone==='success'||tone==='error')window.TahaNative?.haptic?.();
  const id = crypto.randomUUID();
  useToasts.getState().add({ id, message, tone,title:title??(tone==='success'&&message.length<55?message:undefined),createdAt:new Date().toISOString() });
  setTimeout(() => useToasts.getState().remove(id), 3500);
}
