import { NextResponse } from "next/server";
import { readConversationJson, safeConversationId, withConversationRepository } from "@/lib/server-storage/conversationRequest";
import { StorageApiError } from "@/lib/server-storage/errors";
import { requireSameOrigin } from "@/lib/server-storage/request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withConversationRepository(
    request,
    async (repository) => NextResponse.json({ ok: true, conversations: await repository.list() }),
    () => NextResponse.json({ ok: true, conversations: [] }),
  );
}

export async function POST(request: Request) {
  return withConversationRepository(request, async (repository) => {
    requireSameOrigin(request);
    const body = await readConversationJson(request);
    const id = body.id === undefined ? undefined : safeConversationId(body.id);
    if (body.title !== undefined && (typeof body.title !== "string" || body.title.length > 240)) throw new StorageApiError("invalid_request", 400, "会话标题无效。");
    if (body.createdAt !== undefined && (typeof body.createdAt !== "string" || body.createdAt.length > 64 || !Number.isFinite(Date.parse(body.createdAt)))) {
      throw new StorageApiError("invalid_request", 400, "会话创建时间无效。");
    }
    const conversation = await repository.create({ id, title: body.title as string | undefined, createdAt: body.createdAt as string | undefined });
    return NextResponse.json({ ok: true, conversation }, { status: 201 });
  });
}
