import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";

// These are recognizable but deliberately nonfunctional test fixtures, never project credentials.
const privilegedFixtures = [
  "sb_secret_test_only_not_a_real_credential",
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.invalid-test-signature`,
];
for (const fixture of privilegedFixtures) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build"],
    {
      encoding: "utf8",
      env: { ...process.env, VITE_SUPABASE_PUBLISHABLE_KEY: fixture },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(
    result.stdout + result.stderr,
    /contains a privileged server credential/,
  );
  assert.ok(
    !(result.stdout + result.stderr).includes(fixture),
    "Rejected credential value must not be printed",
  );
}
const assets = await readdir("dist/assets");
for (const file of assets.filter((name) => name.endsWith(".js"))) {
  const source = await readFile(`dist/assets/${file}`, "utf8");
  for (const fixture of privilegedFixtures)
    assert.ok(
      !source.includes(fixture),
      "Rejected credential must not appear in a build",
    );
}
console.log(
  "Frontend credential boundary passed: privileged keys rejected before bundling without printing them; no rejected key in output. Local demo business fixtures are intentional, not production secrets.",
);
