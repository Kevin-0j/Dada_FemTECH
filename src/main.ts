import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { compose } from "./compose.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig(process.env);
if (config.DATABASE_PATH !== ":memory:") {
  mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });
}

const { app, referrals, cases } = compose(config);

const purge = (): void => {
  const deleted = referrals.purgeExpired();
  if (deleted > 0) console.info(`[retention] deleted ${deleted} contacted referrals`);
};
purge();
const purgeTimer = setInterval(purge, 6 * 60 * 60 * 1000);
purgeTimer.unref();

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.info(`Dada is listening on http://localhost:${info.port}`);
});

const shutdown = (): void => {
  server.close(() => {
    cases.close();
    process.exit(0);
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
