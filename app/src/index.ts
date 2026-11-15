import { app } from "./app";
import { ENV } from "./constants/env";
import {
  createGracefulShutdown,
  listenForFatalErrors,
  listenForShutdownSignals,
} from "./lib/graceful-shutdown";
import { lifecycleLogger } from "./lib/logger";

app.listen({ port: ENV.PORT, hostname: "0.0.0.0" });

lifecycleLogger.info(
  {
    bindHost: app.server?.hostname,
    port: app.server?.port,
  },
  "Elysia server started",
);

const shutdown = createGracefulShutdown(app);

listenForShutdownSignals(shutdown);
listenForFatalErrors(shutdown);
