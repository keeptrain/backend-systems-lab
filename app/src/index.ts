import { Elysia } from "elysia";
import { deviceIdRateLimit } from "./middleware/rate-limit";

const port = Number(process.env.PORT ?? 3000);

const app = new Elysia()
  .onRequest(deviceIdRateLimit())
  .get("/", () => "Hello Elysia")
  .get('/health', () => "Hello from health endpoint")
  .listen(port);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
