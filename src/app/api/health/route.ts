import { NextResponse } from "next/server";
import { getSafeApplicationHealth } from "@/lib/production/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getSafeApplicationHealth();
  return NextResponse.json(health, {
    status: health.applicationHealthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
