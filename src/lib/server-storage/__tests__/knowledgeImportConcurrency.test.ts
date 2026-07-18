import { afterEach, describe, expect, it } from "vitest";
import {
  knowledgeImportPreviewConcurrencyLimits,
  tryAcquireKnowledgeImportPreviewSlot,
} from "@/lib/server-storage/knowledgeImportConcurrency";

describe("knowledge import preview concurrency guard", () => {
  const releases: Array<() => void> = [];

  afterEach(() => {
    releases.splice(0).forEach((release) => release());
  });

  function acquire(workspaceId: string) {
    const result = tryAcquireKnowledgeImportPreviewSlot(workspaceId);
    if (result.ok) releases.push(result.release);
    return result;
  }

  it("allows only one active preview for a workspace and releases idempotently", () => {
    const first = acquire("workspace-a");
    expect(first.ok).toBe(true);
    expect(acquire("workspace-a")).toEqual({ ok: false, reason: "workspace_limit" });

    if (!first.ok) throw new Error("fixture must acquire the first slot");
    first.release();
    first.release();
    expect(acquire("workspace-a").ok).toBe(true);
  });

  it("caps the process globally while allowing independent workspaces", () => {
    for (let index = 0; index < knowledgeImportPreviewConcurrencyLimits.maximumGlobal; index += 1) {
      expect(acquire(`workspace-${index}`).ok).toBe(true);
    }
    expect(acquire("workspace-overflow")).toEqual({ ok: false, reason: "global_limit" });

    releases.shift()?.();
    expect(acquire("workspace-after-release").ok).toBe(true);
  });
});
