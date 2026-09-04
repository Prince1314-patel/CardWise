import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/server/auth-session";
import { apiErrorResponse } from "@/lib/server/errors";
import { assertSameOrigin } from "@/lib/server/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ status: "signed-out" }, { headers: { "Cache-Control": "no-store" } });
    clearSessionCookies(response);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
