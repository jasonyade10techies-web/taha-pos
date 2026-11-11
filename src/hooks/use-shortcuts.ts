import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSessionStore } from "../stores/session-store";

export function useShortcuts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useSessionStore.getState().setCommandOpen(true);
      }
      if (
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        event.key === "F1"
      ) {
        event.preventDefault();
        navigate("/pos");
      }
      if (
        event.key === "F4" &&
        pathname === "/pos" &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        useSessionStore.getState().setCheckoutOpen(true);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [navigate, pathname]);
}
