import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ArrowUp, ArrowDown, CornerDownLeft, Package, Users, ReceiptText, Wrench, MapPin, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../../stores/session-store";
import { Dialog } from "../ui/dialog";
import { pageResults, searchGroups, searchWorkspace, type SearchGroup, type WorkspaceResult } from "./workspace-search";
import {useShopConfiguration} from '../../hooks/use-shop-configuration';
import {visibleShopRoute} from '../../types/shop-configuration';

const icons = { Products: Package, Customers: Users, Receipts: ReceiptText, Services: Wrench, Locations: MapPin, Pages: ArrowRight };

export function CommandMenu() {
  const {configuration}=useShopConfiguration();
  const open = useSessionStore((s) => s.commandOpen);
  const setOpen = useSessionStore((s) => s.setCommandOpen);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const profile = useSessionStore(s => s.profile), permissions = useSessionStore(s => s.permissions), storeId = useSessionStore(s => s.context?.store?.id ?? "");
  const access = useMemo(() => ({ profile, permissions, storeId }), [profile, permissions, storeId]);
  const [business, setBusiness] = useState<{ query: string; access: typeof access; results: WorkspaceResult[]; unavailable: SearchGroup[] }>();
  const [loading, setLoading] = useState(false), [retry, setRetry] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => useSessionStore.subscribe((state, previous) => {
    if (state.commandOpen && !previous.commandOpen) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }), []);
  const pages = useMemo(() => pageResults(query, access), [query, access]);
  const current = business?.query === query && business.access === access ? business : undefined;
  const results = [...(current?.results ?? []), ...pages].filter(item=>visibleShopRoute(item.path,configuration));
  useEffect(() => {
    if (!open || query.trim().length < 2) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchWorkspace(query, access, cache).then(result => {
        if (!cancelled) { setBusiness({ ...result, query, access }); setLoading(false); setSelected(0); }
      });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query, access, cache, retry]);
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setBusiness(undefined);
    }
  }, [open]);
  const close = (next: boolean) => {
    setOpen(next);
    if (!next) window.setTimeout(() => returnFocus.current?.isConnected && returnFocus.current.focus(), 0);
  };
  const choose = (path: string) => {
    navigate(path);
    close(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Search your workspace"
      description="Find products, customers, receipts, services, locations and pages you can access."
      className="command-dialog"
    >
      <div className="command-search">
        <Search size={20} />
        <input
          aria-label="Search modules"
          placeholder="Search a name, phone, invoice or page…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const next =
                (selected + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                (results.length || 1);
              setSelected(next);
              list.current?.querySelectorAll('[role="option"]')[next]?.scrollIntoView({
                block: "nearest",
              });
            }
            if (e.key === "Enter" && results[selected]) {
              e.preventDefault();
              choose(results[selected].path);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls="command-results"
          aria-activedescendant={
            results[selected] ? `command-${selected}` : undefined
          }
          autoComplete="off"
        />
      </div>
      <div
        id="command-results"
        className="command-results"
        role="listbox"
        ref={list}
        aria-busy={loading}
      >
        {searchGroups.map(group => {
          const grouped = results.filter(item => item.group === group);
          const Icon = icons[group];
          return grouped.length ? <div role="group" aria-label={group} key={group}>
            <div className="px-3 py-2 text-xs font-semibold text-muted">{group}</div>
            {grouped.map(item => {
              const index = results.indexOf(item);
              return (
            <button
              type="button"
              role="option"
              aria-selected={index === selected}
              id={`command-${index}`}
              className={index === selected ? "selected" : ""}
              key={item.id}
              onClick={() => choose(item.path)}
              onMouseMove={() => setSelected(index)}
            >
              <Icon size={19} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <CornerDownLeft size={15} />
            </button>
          );})}</div> : null;
        })}
        {loading && <p className="px-3 py-2 text-sm text-muted" role="status">Searching records…</p>}
        {!loading && !results.length && (
          <p className="p-6 text-center text-muted">
            No matching results. Try a name, phone, invoice or page.
          </p>
        )}
      </div>
      {!!current?.unavailable.length && <div className="px-3 py-2 text-sm" role="status">Could not search {current.unavailable.join(", ")}. Other results are still available. <button type="button" className="text-link" onClick={() => setRetry(value => value + 1)}>Retry search</button></div>}
      <div className="command-footer">
        <span>
          <ArrowUp size={12} />
          <ArrowDown size={12} />
          to navigate
        </span>
        <span>
          <CornerDownLeft size={12} />
          to open
        </span>
        <span>
          <kbd>Esc</kbd>to close
        </span>
      </div>
    </Dialog>
  );
}
