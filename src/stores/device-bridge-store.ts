import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nativeInfo } from "../lib/mobile/runtime";
import type { BridgeAuth, BridgeContext, StaffDevice } from "../types/device-bridge";
import { getTerminalId } from "../lib/terminal-identity";
type BridgeState = {
  terminalId: string; terminalName: string; deviceId: string; deviceName: string;
  auth: BridgeAuth; context: BridgeContext | null; terminalRegistered: boolean;
  devices: StaffDevice[]; ownPair: StaffDevice | null; socket: boolean; connected: boolean;
  lastHeartbeat: string | null; lastRequest: string | null; lastUpload: string | null; error: string;
};
const info = nativeInfo();
export const useDeviceBridgeStore = create<BridgeState>()(persist<BridgeState, [], [], Pick<BridgeState,"terminalId"|"terminalName"|"deviceId"|"deviceName">>(() => ({
  terminalId: getTerminalId(), terminalName: "Main Counter", deviceId: info.deviceId || crypto.randomUUID(),
  deviceName: info.deviceName || "Staff Phone", auth: "loading", context: null,
  terminalRegistered: false, devices: [], ownPair: null, socket: false, connected: false,
  lastHeartbeat: null, lastRequest: null, lastUpload: null, error: "",
}), {
  name: "taha-device-bridge", version: 1,
  partialize: s => ({terminalId:s.terminalId,terminalName:s.terminalName,deviceId:s.deviceId,deviceName:s.deviceName}),
  merge: (saved, current) => ({...current,...saved as Partial<BridgeState>,terminalId:getTerminalId(),deviceId:info.deviceId || (saved as Partial<BridgeState>)?.deviceId || current.deviceId}),
}));
