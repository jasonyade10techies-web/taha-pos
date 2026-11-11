import { cpSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve("server"),
  stage = resolve("artifacts/managed/taha-api-0.5.0");
execFileSync(process.execPath, ["scripts/build-managed.mjs"], {
  cwd: root,
  stdio: "inherit",
});
mkdirSync(stage, { recursive: true });
for (const name of [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.tools.json",
  "src",
  "migrations",
  "dist",
  "dist-tools",
  ".env.managed.example",
])
  cpSync(join(root, name), join(stage, name), { recursive: true });
mkdirSync(join(stage, "scripts"), { recursive: true });
for (const name of [
  "build-managed.mjs",
  "managed-start.mjs",
  "migrate.ts",
  "provision.ts",
])
  cpSync(join(root, "scripts", name), join(stage, "scripts", name));
console.log("Secret-free deploy root: " + stage);
// ZIP creation is optional; the same root works with Hostinger GitHub deployment.
execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "$taskFiles=Get-ChildItem -LiteralPath '" +
      stage.replaceAll("'", "''") +
      "' -Force; Compress-Archive -LiteralPath $taskFiles.FullName -DestinationPath '" +
      resolve("artifacts/managed/Taha-API-managed-0.5.0.zip").replaceAll(
        "'",
        "''",
      ) +
      "' -Force",
  ],
  { stdio: "inherit" },
);
