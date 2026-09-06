import { env } from "cloudflare:workers";
import { ApiError } from "./errors";

type SupabaseSettings = {
  url: string;
  publishableKey: string;
  rateLimitPepper: string;
};

function runtimeValue(name: string) {
  const workerEnv = env as unknown as Record<string, string | undefined>;
  return workerEnv[name] ?? process.env[name];
}

export function getSupabaseSettings(): SupabaseSettings {
  const url = runtimeValue("SUPABASE_URL");
  const publishableKey = runtimeValue("SUPABASE_PUBLISHABLE_KEY");
  const rateLimitPepper = runtimeValue("CARDWISE_AUTH_RATE_LIMIT_PEPPER");
  if (!url || !publishableKey || !rateLimitPepper || rateLimitPepper.length < 32) {
    throw new ApiError(503, "AUTH_NOT_CONFIGURED", "Sign-in is not configured yet.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new ApiError(503, "AUTH_NOT_CONFIGURED", "Sign-in is not configured yet.");
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.pathname !== "/") {
    throw new ApiError(503, "AUTH_NOT_CONFIGURED", "Sign-in is not configured yet.");
  }
  return { url: parsedUrl.origin, publishableKey, rateLimitPepper };
}

export async function supabaseAuthRequest(path: string, init: RequestInit = {}) {
  const settings = getSupabaseSettings();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(`${settings.url}/auth/v1${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: settings.publishableKey,
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable. Please try again.");
  } finally {
    clearTimeout(timeout);
  }
}
