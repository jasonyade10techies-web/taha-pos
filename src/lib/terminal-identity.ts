/** Public terminal identity only. Never contains authentication or business data. */
const key = 'taha-terminal-identity';
const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
let sessionId: string | undefined;

function persistedId(name: string): unknown {
  try {
    const value = localStorage.getItem(name);
    if (!value) return undefined;
    return name === key ? value : JSON.parse(value)?.state?.terminalId;
  } catch { return undefined; }
}

/** Prefer the already-paired bridge UUID when migrating older UI identities. */
export function getTerminalId(): string {
  if (sessionId) return sessionId;
  const candidates = [persistedId('taha-device-bridge'), persistedId(key), persistedId('taha-pos-ui')];
  sessionId = candidates.find((value): value is string => typeof value === 'string' && uuid.test(value)) ?? crypto.randomUUID();
  try { localStorage.setItem(key, sessionId); } catch { /* Stable for this session if storage is unavailable. */ }
  return sessionId;
}
