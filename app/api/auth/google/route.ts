import { NextResponse } from "next/server";
import { authRedirectInputSchema } from "@/lib/auth/validation";
import { createOAuthFlow, setOAuthCookie } from "@/lib/server/auth-session";
import { apiErrorResponse } from "@/lib/server/errors";
import { enforceAuthRateLimit } from "@/lib/server/auth-rate-limit";
import { assertSameOrigin, readJson } from "@/lib/server/request-guard";
import { getSupabaseSettings, safeReturnTo } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceAuthRateLimit(request.headers, 12);
    const input = await readJson(request, authRedirectInputSchema);
    const returnTo = safeReturnTo(input.returnTo);
    const flow = await createOAuthFlow(returnTo);
    const callback = new URL("/api/auth/callback", request.url).toString();
    const authorizeUrl = new URL(`${getSupabaseSettings().url}/auth/v1/authorize`);
    authorizeUrl.searchParams.set("provider", "google");
    authorizeUrl.searchParams.set("redirect_to", callback);
    authorizeUrl.searchParams.set("code_challenge", flow.challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "s256");
    authorizeUrl.searchParams.set("state", flow.state);
    const response = NextResponse.json({ url: authorizeUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
    setOAuthCookie(response, flow.cookieValue);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
