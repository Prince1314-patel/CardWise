import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCard, ensureUser } from "@/lib/server/card-repository";
import { apiErrorResponse, ApiError } from "@/lib/server/errors";
import { requireUserIdentity } from "@/lib/server/identity";
import { assertSameOrigin } from "@/lib/server/request-guard";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

export async function DELETE(request: Request, context: { params: Promise<{ cardId: string }> }) {
  try {
    assertSameOrigin(request);
    const user = requireUserIdentity(request.headers);
    const { cardId } = await context.params;
    if (!idSchema.safeParse(cardId).success) throw new ApiError(400, "INVALID_CARD_ID", "The card ID is invalid.");
    await ensureUser(user);
    await deleteCard(user.id, cardId);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
