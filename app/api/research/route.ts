import { NextResponse } from "next/server";
import { researchInputSchema } from "@/lib/cards/validation";
import { ensureUser, listCards, takeResearchQuota } from "@/lib/server/card-repository";
import { apiErrorResponse, ApiError } from "@/lib/server/errors";
import { requireUserIdentity } from "@/lib/server/identity";
import { assertSameOrigin, readJson } from "@/lib/server/request-guard";
import { researchCardBenefits } from "@/lib/research/openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = requireUserIdentity(request.headers);
    await ensureUser(user);
    const input = await readJson(request, researchInputSchema);
    const card = (await listCards(user.id)).find((item) => item.id === input.cardId);
    if (!card) throw new ApiError(404, "CARD_NOT_FOUND", "That card was not found.");
    await takeResearchQuota(user.id);
    const result = await researchCardBenefits({
      issuer: card.issuer,
      cardName: card.name,
      merchant: input.merchant,
      category: input.category,
      channel: input.channel,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
