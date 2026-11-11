import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import assert from "node:assert/strict";
process.loadEnvFile(resolve("server/.env.mobile-test"));
const address = new URL(process.env.DATABASE_URL);
assert.equal(address.hostname, "127.0.0.1");
assert.equal(address.port, "55439");
const reservation = createServer();
await new Promise((r) => reservation.listen(0, "0.0.0.0", r));
const port = reservation.address().port;
await new Promise((r) => reservation.close(r));
const child = spawn(process.execPath, ["scripts/managed-start.mjs"], {
  cwd: resolve("server"),
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "test",
    STORAGE_DRIVER: "local",
    MIGRATE_ON_START: "false",
    PUBLIC_API_URL: `http://127.0.0.1:${port}`,
  },
  stdio: "ignore",
});
let ready = false;
try {
  const end = Date.now() + 45000;
  while (Date.now() < end) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
        signal: AbortSignal.timeout(2000),
      });
      const health = await response.json();
      if (response.ok && health.database === "connected") {
        ready = true;
        break;
      }
    } catch {
      /* Wait for compiled Nest initialization. */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(
    ready,
    "Compiled managed launcher must use the platform-assigned PORT and reach PostgreSQL",
  );
  console.log(
    "PASS: npm start compiled launcher, assigned PORT, health/database and no Docker requirement.",
  );
} finally {
  child.kill();
}
