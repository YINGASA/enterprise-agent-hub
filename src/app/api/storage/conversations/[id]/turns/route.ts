import { NextResponse } from "next/server";
import { readConversationJson, safeConversationId, safeExpectedRevision, safePersistedMessage, safeSummaryPatch, withConversationRepository } from "@/lib/server-storage/conversationRequest";
import { requireSameOrigin } from "@/lib/server-storage/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return withConversationRepository(request, async (repository) => {
    requireSameOrigin(request);
    const body = await readConversationJson(request);
    const conversation = await repository.appendPersistedTurn({
      conversationId: safeConversationId((await context.params).id),
      expectedRevision: safeExpectedRevision(body.expectedRevision),
      userMessage: safePersistedMessage(body.userMessage, "user"),
      assistantMessage: safePersistedMessage(body.assistantMessage, "assistant"),
      conversationSummaryPatch: safeSummaryPatch(body.conversationSummaryPatch),
    });
    return NextResponse.json({ ok: true, conversation });
  });
}
