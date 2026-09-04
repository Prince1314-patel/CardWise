import { getCookie } from "./cookies";
import { ApiError } from "./errors";

const ACCESS_COOKIE = "cardwise_access";

export type UserIdentity = {
  id: string;
  email: string;
  displayName: string | null;
};

type AuthUser = {
  id?: unknown;
  email?: unknown;
  user_metadata?: { full_name?: unknown; name?: unknown };
};

export type TokenVerifier = (token: string) => Promise<AuthUser | null>;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function extractAccessToken(headers: Headers) {
  const authorization = headers.get("authorization");
  const cookieToken = getCookie(headers, ACCESS_COOKIE);
  if (authorization !== null) {
    if (!authorization.startsWith("Bearer ") || authorization.length < 24 || authorization.length > 12_000) {
      throw new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue.");
    }
    const token = authorization.slice(7);
    if (!/^[A-Za-z0-9._~-]+$/.test(token) || (cookieToken && cookieToken !== token)) {
      throw new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue.");
    }
    return token;
  }
  if (!cookieToken || cookieToken.length < 24 || cookieToken.length > 12_000 || !/^[A-Za-z0-9._~-]+$/.test(cookieToken)) {
    throw new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue.");
  }
  return cookieToken;
}

export async function verifySupabaseToken(token: string): Promise<AuthUser | null> {
  const { supabaseAuthRequest } = await import("./supabase");
  const response = await supabaseAuthRequest("/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  try {
    return await response.json() as AuthUser;
  } catch {
    return null;
  }
}

export async function requireUserIdentity(headers: Headers, verifier: TokenVerifier = verifySupabaseToken): Promise<UserIdentity> {
  const token = extractAccessToken(headers);
  const user = await verifier(token);
  if (!user || typeof user.id !== "string" || !isUuid(user.id) || typeof user.email !== "string" || user.email.length > 254 || !user.email.includes("@")) {
    throw new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue.");
  }
  const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  return {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    displayName: typeof fullName === "string" && fullName.trim().length <= 120 ? fullName.trim() : null,
  };
}
