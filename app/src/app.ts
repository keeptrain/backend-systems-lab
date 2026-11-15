import { Elysia } from "elysia";
import {
  clearRateLimitState,
  deviceIdRateLimit,
} from "./middleware/rate-limit";

const publicRoutes = new Elysia().get("/health", () => "ok");

export const app = new Elysia({
  prefix: "api",
})
  .onRequest(deviceIdRateLimit())
  .onStop(() => {
    clearRateLimitState();
  })
  .use(publicRoutes);
