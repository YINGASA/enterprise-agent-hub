import { knowledgeImportPreviewConcurrencyLimits } from "@/lib/knowledge/import-limits";

export { knowledgeImportPreviewConcurrencyLimits };

type PreviewConcurrencyState = {
  activeGlobal: number;
  activeByWorkspace: Map<string, number>;
};

type PreviewConcurrencyGlobal = typeof globalThis & {
  __enterpriseAgentHubKnowledgeImportPreviewConcurrency?: PreviewConcurrencyState;
};

export type KnowledgeImportPreviewSlot =
  | { ok: true; release: () => void }
  | { ok: false; reason: "workspace_limit" | "global_limit" };

function currentState(): PreviewConcurrencyState {
  const shared = globalThis as PreviewConcurrencyGlobal;
  shared.__enterpriseAgentHubKnowledgeImportPreviewConcurrency ??= {
    activeGlobal: 0,
    activeByWorkspace: new Map(),
  };
  return shared.__enterpriseAgentHubKnowledgeImportPreviewConcurrency;
}

/**
 * Non-blocking, process-local protection for the CPU and memory intensive
 * multipart parsing path. Database quotas remain the durable safety boundary;
 * this guard prevents one process from starting an unbounded number of parsers
 * before those quotas can be checked transactionally.
 */
export function tryAcquireKnowledgeImportPreviewSlot(workspaceId: string): KnowledgeImportPreviewSlot {
  const state = currentState();
  const workspaceActive = state.activeByWorkspace.get(workspaceId) ?? 0;
  if (workspaceActive >= knowledgeImportPreviewConcurrencyLimits.maximumPerWorkspace) {
    return { ok: false, reason: "workspace_limit" };
  }
  if (state.activeGlobal >= knowledgeImportPreviewConcurrencyLimits.maximumGlobal) {
    return { ok: false, reason: "global_limit" };
  }

  state.activeGlobal += 1;
  state.activeByWorkspace.set(workspaceId, workspaceActive + 1);
  let released = false;
  return {
    ok: true,
    release() {
      if (released) return;
      released = true;
      state.activeGlobal = Math.max(0, state.activeGlobal - 1);
      const remaining = Math.max(0, (state.activeByWorkspace.get(workspaceId) ?? 1) - 1);
      if (remaining === 0) state.activeByWorkspace.delete(workspaceId);
      else state.activeByWorkspace.set(workspaceId, remaining);
    },
  };
}
