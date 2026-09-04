import { NextResponse } from "next/server";
import { getCookie, REFRESH_COOKIE, setSessionCookies } from "@/lib/server/auth-session";
import { apiErrorResponse, ApiError } from "@/lib/server/errors";
import { enforceAuthRateLimit } from "@/lib/server/auth-rate-limit";
import { assertSameOrigin } from "@/lib/server/request-guard";
import { supabaseAuthRequest } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

type AuthSessionResponse = { access_token?: string; refresh_token?: string; expires_in?: number };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceAuthRateLimit(request.headers, 20);
    const refreshToken = getCookie(request.headers, REFRESH_COOKIE);
    if (!refreshToken || refreshToken.length > 12_000) throw new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue.");
    const response = await supabaseAuthRequest("/token?grant_type=refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) throw new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue.");
    const session = await response.json() as AuthSessionResponse;
    const result = NextResponse.json({ status: "refreshed" }, { headers: { "Cache-Control": "no-store" } });
    setSessionCookies(result, session as Required<AuthSessionResponse>);
    return result;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
