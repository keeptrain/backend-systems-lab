import { Elysia } from "elysia";
import {
  clearRateLimitState,
  deviceIdRateLimit,
} from "./middleware/rate-limit";

const publicRoutes = new Elysia()
  .get("/", () => "Hello Elysia")
  .get("/health", () => "Hello from health endpoint");

export const app = new Elysia()
  .onRequest(deviceIdRateLimit())
  .onStop(() => {
      clearRateLimitState();
  })
  .use(publicRoutes);
