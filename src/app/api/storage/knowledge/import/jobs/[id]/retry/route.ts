import { runKnowledgeImportAction } from "@/app/api/storage/knowledge/import/jobs/[id]/action";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export function POST(request: Request, context: RouteContext) {
  return runKnowledgeImportAction(request, context, "retryFailed");
}
