import { create } from "zustand";
import type { CameraJob, CameraJobStatus, CameraJobType } from "../types/phase4b";

type CameraState = {
  jobs: CameraJob[];
  receive: (job: CameraJob) => void;
  request: (input: Omit<CameraJob, "id" | "status" | "createdAt">) => CameraJob;
  update: (id: string, patch: Partial<CameraJob>) => void;
  complete: (id: string, imageDataUrl: string) => void;
  fail: (id: string, error: string) => void;
  remove: (id: string) => void;
};

const cameraChannel = () =>
  "BroadcastChannel" in window ? new BroadcastChannel("taha-pos-camera-jobs") : null;

export const useCameraStore = create<CameraState>((set, get) => ({
  jobs: [],
  receive: job => set(s => ({jobs:s.jobs.some(j=>j.id===job.id) ? s.jobs.map(j=>j.id===job.id ? {...j,...job} : j) : [job,...s.jobs]})),
  request: (input) => {
    const job: CameraJob = {
      ...input,
      id: crypto.randomUUID(),
      status: "waiting",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now()+10*60_000).toISOString(),
    };
    set((s) => ({ jobs: [job, ...s.jobs] }));
    const channel = cameraChannel();
    channel?.postMessage({ type: "camera.requested", terminalId: job.terminalId, job });
    channel?.close();
    return job;
  },
  update: (id, patch) => {
    const job = get().jobs.find(j=>j.id===id);
    if (!job || ["received","cancelled","expired"].includes(job.status)) return;
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));
    const channel = cameraChannel();
    channel?.postMessage({ type: "camera.updated", terminalId:job.terminalId, id, patch });
    channel?.close();
  },
  complete: (id, imageDataUrl) => {
    get().update(id, { status: "received", imageDataUrl });
  },
  fail: (id, error) => get().update(id, { status: "failed", error }),
  remove: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
}));

export function cameraStatusLabel(status: CameraJobStatus) {
  return {
    waiting: "Waiting for photo…",
    opened: "Taking photo…",
    captured: "Receiving photo…",
    uploading: "Receiving photo…",
    received: "Photo added ✓",
    failed: "Could not send photo",
    expired: "Request expired", cancelled: "Request cancelled",
  }[status];
}

export function cameraTypeLabel(type: CameraJobType) {
  return {
    "connection-test": "Connection Test",
    "payment-proof": "Payment Proof",
    "product-photo": "Product Photo",
    "used-device-photo": "Used Device Photo",
    "repair-intake": "Repair Intake Photo",
    "customer-photo": "Customer Photo",
    "profile-picture": "Profile Picture",
    "damage-evidence": "Damage Evidence",
    "receipt-document": "Receipt / Document Photo",
  }[type];
}
