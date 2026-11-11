import { useEffect } from "react";
import { useUiStore } from "../stores/ui-store";
import { applyAppearance } from "../lib/appearance";

export function useTheme() {
  const theme = useUiStore((s) => s.theme);
  const appearance = useUiStore((s) => s.previewAppearance ?? s.appearance);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && query.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      applyAppearance(appearance);
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [theme, appearance]);
}
