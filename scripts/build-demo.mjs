import { spawnSync } from "node:child_process";
const check = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-b"],
  { stdio: "inherit" },
);
if (check.status !== 0) process.exit(check.status ?? 1);
const build = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-demo"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DATA_PROVIDER: "local",
      VITE_USE_MOCK_AUTH: "true",
      // The local business demo still connects real phones through the shop API.
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || "/api/v1",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
);
process.exitCode = build.status ?? 1;
