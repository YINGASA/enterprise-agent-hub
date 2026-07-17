import { NextResponse } from "next/server";
import { getSafeStorageStatus, type SafeStorageStatus } from "@/lib/server-storage/status";
import { resolveRequestWorkspace } from "@/lib/server-storage/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: SafeStorageStatus) {
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const status = await getSafeStorageStatus();
  if (status.storageMode !== "server") return json(status);

  try {
    const workspace = await resolveRequestWorkspace(request, { createIfMissing: false });
    const response = json(status);
    response.headers.set("Vary", "Cookie");
    if (workspace?.setCookie) response.headers.append("Set-Cookie", workspace.setCookie);
    return response;
  } catch {
    return json({ ...status, healthy: false, storageMode: "degraded" });
  }
}
