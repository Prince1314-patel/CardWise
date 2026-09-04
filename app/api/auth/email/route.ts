import { NextResponse } from "next/server";
import { emailAuthInputSchema } from "@/lib/auth/validation";
import { setSessionCookies } from "@/lib/server/auth-session";
import { apiErrorResponse, ApiError } from "@/lib/server/errors";
import { enforceAuthRateLimit } from "@/lib/server/auth-rate-limit";
import { assertSameOrigin, readJson } from "@/lib/server/request-guard";
import { supabaseAuthRequest } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

type AuthSessionResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceAuthRateLimit(request.headers, 6);
    const input = await readJson(request, emailAuthInputSchema);
    const path = input.mode === "sign-up" ? "/signup" : "/token?grant_type=password";
    const response = await supabaseAuthRequest(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email, password: input.password }),
    });

    if (!response.ok) {
      throw new ApiError(401, "AUTH_FAILED", "We could not sign you in with those details.");
    }

    const payload = await response.json() as AuthSessionResponse;
    if (input.mode === "sign-up" && !payload.access_token) {
      return NextResponse.json({ status: "verification-required" }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }
    const result = NextResponse.json({ status: "signed-in" }, { headers: { "Cache-Control": "no-store" } });
    setSessionCookies(result, payload as Required<AuthSessionResponse>);
    return result;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
