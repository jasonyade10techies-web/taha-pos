import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
const tsc = "node_modules/typescript/bin/tsc";
execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], {
  stdio: "inherit",
});
execFileSync(process.execPath, [tsc, "-p", "tsconfig.tools.json"], {
  stdio: "inherit",
});
mkdirSync("dist-tools/migrations", { recursive: true });
cpSync("migrations", "dist-tools/migrations", { recursive: true });
console.log(
  "Managed Node package ready: dist/main.js and compiled migration/provision tools.",
);
