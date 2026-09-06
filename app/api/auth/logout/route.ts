import { NextResponse } from "next/server";
import { ACCESS_COOKIE, clearSessionCookies, getCookie } from "@/lib/server/auth-session";
import { apiErrorResponse } from "@/lib/server/errors";
import { assertSameOrigin } from "@/lib/server/request-guard";
import { supabaseAuthRequest } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const accessToken = getCookie(request.headers, ACCESS_COOKIE);
    if (accessToken) {
      await supabaseAuthRequest("/logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => undefined);
    }
    const response = NextResponse.json({ status: "signed-out" }, { headers: { "Cache-Control": "no-store" } });
    clearSessionCookies(response);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
