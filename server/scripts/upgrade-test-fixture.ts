import { migrate, runtimeRole } from "./migrate";
import pg from "pg";
async function run() {
  const runtime = process.env.DATABASE_URL;
  if (!runtime)
    throw new Error("Load the existing local test fixture environment.");
  const url = new URL(runtime);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55439" ||
    !url.pathname.startsWith("/taha_api_browser_")
  )
    throw new Error(
      "This helper only upgrades the existing local browser test database.",
    );
  url.username = "taha_test";
  url.password = "";
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await migrate(client);
    await runtimeRole(client, runtime);
  } finally {
    await client.end();
  }
}
void run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
