import { app } from "./app";
import { ENV } from "./constants/env";
import {
  createGracefulShutdown,
  listenForShutdownSignals,
} from "./lib/graceful-shutdown";
import { logger } from "./lib/logger";

app.listen({ port: ENV.PORT, hostname: "0.0.0.0" });

logger.info(
  {
    bindHost: app.server?.hostname,
    port: app.server?.port,
  },
  "Elysia server started",
);

listenForShutdownSignals(createGracefulShutdown(app));
