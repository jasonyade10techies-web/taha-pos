import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, Bell, CheckCircle2, Clock, ScanLine } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { MobileCaptureCard } from "../pos/mobile-capture-card";
import { MobilePairing } from "../pos/mobile-pairing";
import { useCameraStore, cameraTypeLabel } from "../../stores/camera-store";
import { useCameraTransport } from "../../hooks/use-camera-transport";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import { cameraService, cameraError } from "../../lib/camera-service";
import { useQuery } from "@tanstack/react-query";
import { staffService, mobileRead } from "../../lib/mobile/staff-service";
import { cachedRead } from "../../lib/mobile/read-cache";
import type { CameraJob } from "../../types/phase4b";
import {SavedPhotoRecovery} from './saved-photo-recovery';
export function MobileActivityPage() {
  const [params, setParams] = useSearchParams(),
    bridge = useDeviceBridgeStore();
  const terminal =
    params.get("terminal") || bridge.ownPair?.terminalId || bridge.terminalId;
  useCameraTransport(terminal, true);
  const jobs = useCameraStore((s) => s.jobs);
  const [selected, setSelected] = useState<string | null>(params.get("job")),
    [error, setError] = useState("");
  const tab = params.get("tab") || "all",
    seen = useRef(new Set<string>());
  useEffect(() => {
    if (bridge.auth === "signed-in") return;
    void cachedRead<CameraJob[]>("camera-jobs").then((rows) => {
      if (rows && useDeviceBridgeStore.getState().auth !== "signed-in")
        rows.forEach((j) => useCameraStore.getState().receive(j));
    });
  }, [bridge.auth]);
  const pending = jobs.filter(
    (j) =>
      !j.diagnostic &&
      !["received", "cancelled", "expired"].includes(j.status) &&
      (!j.expiresAt || Date.parse(j.expiresAt) > Date.now()),
  );
  useEffect(() => {
    const id = params.get("job"),
      token = params.get("claim");
    if (!id) return;
    setSelected(id);
    if (token)
      void cameraService
        .claim(id, token)
        .then(() => {
          const next = new URLSearchParams(params);
          next.delete("claim");
          next.delete("store");
          setParams(next, { replace: true });
        })
        .catch((c) => setError(cameraError(c)));
  }, [params, setParams]);
  useEffect(() => {
    const next = pending.find((j) => !seen.current.has(j.id));
    if (next && !selected) {
      seen.current.add(next.id);
      setSelected(next.id);
    }
  }, [pending, selected]);
  const activity = useQuery({
    queryKey: ["staff-activity"],
    queryFn: staffService.dashboard,
    enabled: staffService.allow("sales.view"),
  });
  const approvals = useQuery({
    queryKey: ["staff-approvals"],
    queryFn: () =>
      mobileRead<{ id: string; action?: string; status?: string }[]>(
        "/mobile/approvals",
      ),
    enabled: tab === "approvals",
  });
  const job = jobs.find((j) => j.id === selected),
    completed = jobs.filter((j) => j.status === "received").slice(0, 10);
  const close = () => {
    setSelected(null);
    const next = new URLSearchParams(params);
    next.delete("job");
    setParams(next, { replace: true });
  };
  const rows =
    tab === "completed"
      ? completed
      : tab === "alerts" || tab === "approvals"
        ? []
        : pending;
  return (
    <div className="staff-page">
      <div className="staff-page-heading">
        <span className="eyebrow">YOUR WORKSPACE</span>
        <h1>Activity</h1>
        <p>Requests, alerts and recent updates.</p>
      </div>
      {params.get("pair") && (
        <MobilePairing code={params.get("pair")!} automatic />
      )}
      <div
        className="staff-filter-tabs"
        role="tablist"
        aria-label="Activity filters"
      >
        {["all", "requests", "alerts", "completed", "approvals"].map(
          (value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("tab", value);
                setParams(next);
              }}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ),
        )}
      </div>
      {error && (
        <p className="text-danger" role="alert">
          {error}
        </p>
      )}
      {rows.map((item) => (
        <article className="panel staff-request-card" key={item.id}>
          <span className="staff-row-icon">
            {item.status === "received" ? (
              <CheckCircle2 size={22} />
            ) : (
              <Camera size={22} />
            )}
          </span>
          <div>
            <small>{cameraTypeLabel(item.type)}</small>
            <h2>{item.title}</h2>
            <span>
              {item.status === "received" ? "Completed" : "Photo requested"} ·{" "}
              {new Date(item.createdAt).toLocaleTimeString("en", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <Button size="small" onClick={() => setSelected(item.id)}>
            {item.status === "received" ? "View" : "Open"}
          </Button>
        </article>
      ))}
      <SavedPhotoRecovery/>
      {(tab === "all" || tab === "alerts") &&
        activity.data?.data.activity.map((item) => (
          <article className="staff-activity-row" key={item.id}>
            <Bell size={18} />
            <div>
              <strong>{item.text}</strong>
              <small>{item.time}</small>
            </div>
          </article>
        ))}
      {tab === "approvals" &&
        (approvals.data?.data.length ? (
          approvals.data.data.map((item) => (
            <article className="panel staff-request-card" key={item.id}>
              <Clock />
              <div>
                <h2>{item.action || "Approval record"}</h2>
                <p>{item.status || "Recorded"}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="panel staff-empty-copy">
            No recent approvals. Approvals recorded at the counter appear here.
          </div>
        ))}
      {!rows.length &&
        tab !== "approvals" &&
        !(
          activity.data?.data.activity.length &&
          (tab === "all" || tab === "alerts")
        ) && (
          <section className="panel staff-empty">
            <CheckCircle2 size={30} />
            <h2>You're all caught up</h2>
            <p>New photo requests appear here automatically.</p>
            <Button
              onClick={() => window.dispatchEvent(new Event("taha-scan-open"))}
            >
              <ScanLine size={18} />
              Scan a request QR
            </Button>
          </section>
        )}
      <Dialog
        open={!!job}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={
          job?.type === "connection-test" ? "Connection Test" : "Photo Request"
        }
        description="TAHA MOBILES"
        className="bottom-sheet"
      >
        {job && <MobileCaptureCard job={job} onClose={close} />}
      </Dialog>
    </div>
  );
}
