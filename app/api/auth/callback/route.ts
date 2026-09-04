import { NextResponse } from "next/server";
import { clearOAuthCookie, getCookie, OAUTH_COOKIE, readOAuthFlow, setSessionCookies } from "@/lib/server/auth-session";
import { apiErrorResponse, ApiError } from "@/lib/server/errors";
import { safeReturnTo, supabaseAuthRequest } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

type AuthSessionResponse = { access_token?: string; refresh_token?: string; expires_in?: number };

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || code.length > 1_500 || state.length > 200) throw new ApiError(400, "INVALID_AUTH_FLOW", "This sign-in link is invalid or has expired.");
    const flow = await readOAuthFlow(getCookie(request.headers, OAUTH_COOKIE), state);
    const response = await supabaseAuthRequest("/token?grant_type=pkce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_code: code, code_verifier: flow.verifier }),
    });
    if (!response.ok) throw new ApiError(401, "AUTH_FAILED", "Google sign-in could not be completed.");
    const session = await response.json() as AuthSessionResponse;
    const redirect = NextResponse.redirect(new URL(safeReturnTo(flow.returnTo), request.url));
    clearOAuthCookie(redirect);
    setSessionCookies(redirect, session as Required<AuthSessionResponse>);
    return redirect;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
