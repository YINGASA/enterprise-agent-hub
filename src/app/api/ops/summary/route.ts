import { NextResponse } from "next/server";
import { getLlmConfig } from "@/lib/llm";
import { isOpsTokenConfigured, validateOpsToken } from "@/lib/ops/auth";
import { getOpsSummary } from "@/lib/ops/storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isOpsTokenConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "ops_token_not_configured",
        message: "运维口令未配置。请在服务端环境变量中配置 EAH_OPS_TOKEN 后再访问运行状态。",
      },
      { status: 503 },
    );
  }

  if (!validateOpsToken(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "运维口令不正确。" }, { status: 401 });
  }

  const summary = await getOpsSummary(getLlmConfig().isConfigured);
  return NextResponse.json({ ok: true, summary });
}
