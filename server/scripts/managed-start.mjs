import { createRequire } from "node:module";
if (process.env.MIGRATE_ON_START === "true")throw Error('Startup migrations are disabled. Run the separately approved migration command before starting the application.');
const require = createRequire(import.meta.url);
const { createApp, startLanTls } = require("../dist/main.js");
const { configuration } = require("../dist/config.js");
const app = await createApp();
const config=configuration();
await app.listen(config.port,config.bindHost);
await startLanTls(app);
