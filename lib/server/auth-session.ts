import { NextResponse } from "next/server";
import { ApiError } from "./errors";
import { getSupabaseSettings } from "./supabase";

export const ACCESS_COOKIE = "cardwise_access";
export const REFRESH_COOKIE = "cardwise_refresh";
export const OAUTH_COOKIE = "cardwise_oauth";

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

function base64Url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function randomValue(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

async function hmac(value: string) {
  const secret = new TextEncoder().encode(getSupabaseSettings().cookieSecret);
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function createOAuthFlow(returnTo: string) {
  const verifier = randomValue(48);
  const state = randomValue(24);
  const challengeDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(challengeDigest));
  const encodedReturnTo = encodeURIComponent(returnTo);
  const payload = `${state}.${verifier}.${encodedReturnTo}`;
  return { state, verifier, challenge, cookieValue: `${payload}.${await hmac(payload)}` };
}

export async function readOAuthFlow(cookieValue: string | undefined, expectedState: string) {
  if (!cookieValue || cookieValue.length > 600) throw new ApiError(400, "INVALID_AUTH_FLOW", "This sign-in link is invalid or has expired.");
  const parts = cookieValue.split(".");
  if (parts.length !== 4) throw new ApiError(400, "INVALID_AUTH_FLOW", "This sign-in link is invalid or has expired.");
  const [state, verifier, encodedReturnTo, signature] = parts;
  const payload = `${state}.${verifier}.${encodedReturnTo}`;
  if (!constantTimeEqual(state, expectedState) || !constantTimeEqual(signature, await hmac(payload))) {
    throw new ApiError(400, "INVALID_AUTH_FLOW", "This sign-in link is invalid or has expired.");
  }
  try {
    return { verifier, returnTo: decodeURIComponent(encodedReturnTo) };
  } catch {
    throw new ApiError(400, "INVALID_AUTH_FLOW", "This sign-in link is invalid or has expired.");
  }
}

export function setOAuthCookie(response: NextResponse, value: string) {
  response.cookies.set(OAUTH_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/callback",
    maxAge: 10 * 60,
  });
}

export function clearOAuthCookie(response: NextResponse) {
  response.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/callback", maxAge: 0 });
}

export function setSessionCookies(response: NextResponse, session: SupabaseSession) {
  if (!session.access_token || !session.refresh_token || !Number.isFinite(session.expires_in)) {
    throw new ApiError(502, "INVALID_AUTH_RESPONSE", "Sign-in returned an invalid session.");
  }
  response.cookies.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, Math.min(Math.floor(session.expires_in), 60 * 60)),
  });
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set(name, "", { httpOnly: true, secure: true, sameSite: name === ACCESS_COOKIE ? "lax" : "strict", path: name === ACCESS_COOKIE ? "/" : "/api/auth/refresh", maxAge: 0 });
  }
}

export { getCookie } from "./cookies";
