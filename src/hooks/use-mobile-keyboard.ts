import { useEffect } from "react";
import { useMobilePreferences } from "../stores/mobile-preferences-store";
/** The OS keyboard resizes Android's viewport. Hide navigation rather than floating it over fields. */
export function useMobileKeyboard() {
  useEffect(() => {
    let baseline = window.visualViewport?.height || innerHeight;
    const viewport = window.visualViewport;
    const update = () => {
      const editable =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.matches("input,textarea,[contenteditable=true]");
      const height = viewport?.height || innerHeight;
      if (!editable) baseline = Math.max(baseline, height);
      const open = editable && baseline - height > 140;
      useMobilePreferences.setState({ keyboardOpen: open });
      document.documentElement.classList.toggle("mobile-keyboard-open", open);
      if (open)
        document.activeElement?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
    };
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.documentElement.classList.remove("mobile-keyboard-open");
    };
  }, []);
}
