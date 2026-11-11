import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
if (process.env.MIGRATE_ON_START === "true")
  execFileSync(process.execPath, ["dist-tools/scripts/migrate.js"], {
    stdio: "inherit",
  });
const require = createRequire(import.meta.url);
const { createApp, startLanTls } = require("../dist/main.js");
const { configuration } = require("../dist/config.js");
const app = await createApp();
await app.listen(configuration().port, "0.0.0.0");
await startLanTls(app);
