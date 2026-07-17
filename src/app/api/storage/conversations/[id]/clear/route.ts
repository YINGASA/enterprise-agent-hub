import { NextResponse } from "next/server";
import { readConversationJson, safeConversationId, safeExpectedRevision, withConversationRepository } from "@/lib/server-storage/conversationRequest";
import { requireSameOrigin } from "@/lib/server-storage/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return withConversationRepository(request, async (repository) => {
    requireSameOrigin(request);
    const conversation = await repository.clear({
      conversationId: safeConversationId((await context.params).id),
      expectedRevision: safeExpectedRevision((await readConversationJson(request)).expectedRevision),
    });
    return NextResponse.json({ ok: true, conversation });
  });
}
