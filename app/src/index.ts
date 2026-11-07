import { app } from "./app";
import { ENV } from "./constants/env";
import {
  createGracefulShutdown,
  listenForShutdownSignals,
} from "./lifecycle/graceful-shutdown";

app.listen({ port: ENV.PORT, hostname: "0.0.0.0" });

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

listenForShutdownSignals(createGracefulShutdown(app));
