import { Elysia } from "elysia";
import {
  clearRateLimitState,
  deviceIdRateLimit,
} from "./middleware/rate-limit";

export const app = new Elysia()
  .onRequest(deviceIdRateLimit())
  .onStop(() => {
    clearRateLimitState();
  })
  .get("/", () => "Hello Elysia")
  .get("/health", () => "Hello from health endpoint");
