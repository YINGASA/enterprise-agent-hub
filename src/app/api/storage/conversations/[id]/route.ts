import { NextResponse } from "next/server";
import { readConversationJson, safeConversationId, safeExpectedRevision, withConversationRepository } from "@/lib/server-storage/conversationRequest";
import { StorageApiError } from "@/lib/server-storage/errors";
import { requireSameOrigin } from "@/lib/server-storage/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return withConversationRepository(request, async (repository) => {
    const id = safeConversationId((await context.params).id);
    const conversation = await repository.get(id);
    if (!conversation) throw new StorageApiError("not_found", 404, "会话不存在。");
    return NextResponse.json({ ok: true, conversation });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return withConversationRepository(request, async (repository) => {
    requireSameOrigin(request);
    const id = safeConversationId((await context.params).id);
    const body = await readConversationJson(request);
    if (typeof body.title !== "string" || body.title.length > 240) throw new StorageApiError("invalid_request", 400, "会话标题无效。");
    const conversation = await repository.rename({ conversationId: id, expectedRevision: safeExpectedRevision(body.expectedRevision), title: body.title });
    return NextResponse.json({ ok: true, conversation });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return withConversationRepository(request, async (repository) => {
    requireSameOrigin(request);
    const id = safeConversationId((await context.params).id);
    const body = await readConversationJson(request);
    await repository.remove({ conversationId: id, expectedRevision: safeExpectedRevision(body.expectedRevision) });
    return NextResponse.json({ ok: true });
  });
}
