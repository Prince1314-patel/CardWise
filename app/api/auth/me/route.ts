import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/errors";
import { requireUserIdentity } from "@/lib/server/identity";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUserIdentity(request.headers);
    return NextResponse.json({ user }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
