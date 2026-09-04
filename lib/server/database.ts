import { env } from "cloudflare:workers";
import { ApiError } from "./errors";

export function getDatabase(): D1Database {
  if (!env.DB) {
    throw new ApiError(503, "STORAGE_UNAVAILABLE", "Your wallet is temporarily unavailable. Please try again shortly.");
  }
  return env.DB;
}
