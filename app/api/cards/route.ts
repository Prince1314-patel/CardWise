import { NextResponse } from "next/server";
import { cardInputSchema } from "@/lib/cards/validation";
import { createCard, ensureUser, listCards } from "@/lib/server/card-repository";
import { apiErrorResponse } from "@/lib/server/errors";
import { requireUserIdentity } from "@/lib/server/identity";
import { assertSameOrigin, readJson } from "@/lib/server/request-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUserIdentity(request.headers);
    await ensureUser(user);
    return NextResponse.json({ cards: await listCards(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUserIdentity(request.headers);
    await ensureUser(user);
    const input = await readJson(request, cardInputSchema);
    const card = await createCard(user.id, input);
    return NextResponse.json({ card }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
