import { NextResponse } from "next/server";
import { recommendationInputSchema } from "@/lib/cards/validation";
import { ensureUser, listCards, recordRecommendation } from "@/lib/server/card-repository";
import { apiErrorResponse, ApiError } from "@/lib/server/errors";
import { requireUserIdentity } from "@/lib/server/identity";
import { assertSameOrigin, readJson } from "@/lib/server/request-guard";
import { rankCards } from "@/lib/rewards/engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUserIdentity(request.headers);
    await ensureUser(user);
    const purchase = await readJson(request, recommendationInputSchema);
    const cards = await listCards(user.id);
    if (!cards.length) throw new ApiError(409, "NO_CARDS", "Add at least one card before requesting a recommendation.");
    const recommendations = rankCards(cards, purchase);
    await recordRecommendation(user.id, purchase);
    return NextResponse.json({ recommendations, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
