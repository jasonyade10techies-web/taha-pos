import type { SessionContext } from "./auth";
export type BridgeAuth = "loading" | "signed-out" | "signed-in";
export type StaffDevice = {
  id: string; deviceId?: string; deviceName: string; terminalId: string; terminalName?: string;
  platform?: string; online: boolean; pairedToThisDevice?: boolean; lastActiveAt?: string; lastSeen?: string;
};
export type PairingCode = {
  id: string; code: string; qrPayload: string; expiresAt: string; terminalId: string;
  terminalName: string; shopAddress: string; shopName: string; branchName: string;
};
export type BridgeContext = SessionContext;
