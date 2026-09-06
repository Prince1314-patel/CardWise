import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "./errors";

export const ACCESS_COOKIE = "cardwise_access";
export const REFRESH_COOKIE = "cardwise_refresh";

const sessionSchema = z.object({
  access_token: z.string().min(24).max(12_000).regex(/^[A-Za-z0-9._~-]+$/),
  refresh_token: z.string().min(24).max(12_000).regex(/^[A-Za-z0-9._~-]+$/),
  expires_in: z.number().finite().positive(),
}).strict();

export function setSessionCookies(response: NextResponse, candidate: unknown) {
  const parsed = sessionSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ApiError(502, "INVALID_AUTH_RESPONSE", "Sign-in returned an invalid session.");
  }
  const session = parsed.data;
  response.cookies.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
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
    response.cookies.set(name, "", { httpOnly: true, secure: true, sameSite: "strict", path: name === ACCESS_COOKIE ? "/" : "/api/auth/refresh", maxAge: 0 });
  }
}

export { getCookie } from "./cookies";
