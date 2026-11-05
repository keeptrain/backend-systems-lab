import { Elysia } from "elysia";
import { ENV } from "./constants/env";
import { deviceIdRateLimit } from "./middleware/rate-limit";

const app = new Elysia()
  .onRequest(deviceIdRateLimit())
  .get("/", () => "Hello Elysia")
  .get("/health", () => "Hello from health endpoint")
  .listen(ENV.PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

process.on("SIGTERM", () => {
  console.log("Server is shutting down");
});

process.once("SIGINT", async () => {
  console.log("Server is interrupted");
  await app.stop();
  console.log("Server is stopped");
});
