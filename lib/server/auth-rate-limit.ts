import { takeAuthQuota } from "./card-repository";
import { ApiError } from "./errors";
import { getSupabaseSettings } from "./supabase";

function clientAddress(headers: Headers) {
  const ip = headers.get("cf-connecting-ip");
  if (!ip || ip.length > 64 || !/^[0-9a-f:.]+$/i.test(ip)) return "unknown";
  return ip;
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function enforceAuthRateLimit(headers: Headers, maximumPerWindow = 8) {
  const pepper = getSupabaseSettings().rateLimitPepper;
  const material = new TextEncoder().encode(`cardwise-auth-v1:${pepper}:${clientAddress(headers)}`);
  const fingerprint = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", material)));
  if (fingerprint.length !== 64) throw new ApiError(503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable. Please try again.");
  await takeAuthQuota(fingerprint, maximumPerWindow);
}
