import { NextResponse } from "next/server";
import { emailAuthInputSchema } from "@/lib/auth/validation";
import { setSessionCookies } from "@/lib/server/auth-session";
import { apiErrorResponse, ApiError } from "@/lib/server/errors";
import { enforceAuthRateLimit } from "@/lib/server/auth-rate-limit";
import { assertSameOrigin, readJson } from "@/lib/server/request-guard";
import { supabaseAuthRequest } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readJson(request, emailAuthInputSchema);
    await enforceAuthRateLimit(request.headers, 6, input.email);
    const path = input.mode === "sign-up" ? "/signup" : "/token?grant_type=password";
    const response = await supabaseAuthRequest(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email, password: input.password }),
    });

    if (!response.ok) {
      throw new ApiError(401, "AUTH_FAILED", "We could not sign you in with those details.");
    }

    const payload: unknown = await response.json();
    const hasAccessToken = typeof payload === "object" && payload !== null && "access_token" in payload && typeof payload.access_token === "string";
    if (input.mode === "sign-up" && !hasAccessToken) {
      return NextResponse.json({ status: "verification-required" }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }
    const result = NextResponse.json({ status: "signed-in" }, { headers: { "Cache-Control": "no-store" } });
    setSessionCookies(result, payload);
    return result;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
