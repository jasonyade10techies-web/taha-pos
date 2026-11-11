import { getApiBaseUrl } from "../config";
import { apiRequest } from "./client";
import { storePath } from "./media";
import type { CustomerDisplayState } from "../../types/phase4b";

export type DisplayRegistration = { displaySessionId: string; pairingCode: string; displayToken: string; expiresAt: string };
export type DisplayConnection = { id?: string; displaySessionId?: string; terminalId?: string; status: string; online?: boolean; updatedAt?: string; snapshot?: CustomerDisplayState };

// Public display requests deliberately carry no staff cookies or staff JWT.
async function displayRequest<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { method: token ? "GET" : "POST", credentials: "omit", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(token ? {} : { body: JSON.stringify({ deviceName: "Customer Display" }) }) });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error=new Error(data?.message || "Cannot connect the customer display. Check the connection and retry.");
    Object.assign(error,{status:response.status});throw error;
  }
  return data as T;
}
export const remoteDisplay = {
  register: () => displayRequest<DisplayRegistration>("/displays"),
  read: (registration: DisplayRegistration) => displayRequest<DisplayConnection>(`/displays/${registration.displaySessionId}`, registration.displayToken),
  pair: (pairingCode: string, terminalId: string) => apiRequest<DisplayConnection>(`${storePath()}/displays/pair`, { method: "POST", body: JSON.stringify({ pairingCode, terminalId }) }),
  list: (terminalId: string) => apiRequest<DisplayConnection[]>(`${storePath()}/displays?terminalId=${encodeURIComponent(terminalId)}`),
  publish: (id: string, terminalId: string, snapshot: CustomerDisplayState) => apiRequest(`${storePath()}/displays/${id}`, { method: "PUT", body: JSON.stringify({ terminalId, snapshot }) }),
  disconnect: (id: string) => apiRequest(`${storePath()}/displays/${id}`, { method: "DELETE" }),
};
