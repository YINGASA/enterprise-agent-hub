import { afterEach, describe, expect, it, vi } from "vitest";
import * as agent from "@/lib/agent";
import { createRetriever } from "@/lib/retrieval";
import { runRagTestDiagnostic } from "@/lib/knowledge/ragTest";
import { loadRagTestHistory, RAG_TEST_HISTORY_STORAGE_KEY, saveRagTestHistoryItem } from "@/lib/knowledge/ragTestHistory";
import type { KnowledgeDocument } from "@/types";

function document(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: "laptop-policy",
    title: "公司笔记本电脑申请制度",
    category: "设备管理",
    tags: ["电脑", "申请", "设备"],
    content: "公司笔记本电脑申请适用于正式员工和新入职员工，需要提交设备申请并完成主管审批。",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    source: "pasted text",
    owner: "用户导入",
    isDefault: false,
    sourceType: "user_paste",
    enabled: true,
    ...overrides,
  };
}

function installLocalStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) } },
  });
  return data;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  vi.restoreAllMocks();
});

describe("RAG test bench", () => {
  it("hits an enabled user document without invoking tools or a model", () => {
    const selectTools = vi.spyOn(agent, "selectTools");
    const result = runRagTestDiagnostic("公司电脑怎么申请？", [document()], "laptop-policy");
    expect(result.hitCurrentDocument).toBe(true);
    expect(result.currentDocumentIsTopSource).toBe(true);
    expect(result.hitUserDocument).toBe(true);
    expect(result.sources[0]?.documentId).toBe("laptop-policy");
    expect(selectTools).not.toHaveBeenCalled();
  });

  it("excludes a disabled current document", () => {
    const result = runRagTestDiagnostic("公司电脑怎么申请？", [document({ enabled: false })], "laptop-policy");
    expect(result.hitCurrentDocument).toBe(false);
    expect(result.currentDocumentMissReason).toContain("已禁用");
    expect(result.sources).toHaveLength(0);
  });

  it("does not treat unrelated user content as a reliable source and keeps candidate count aligned", () => {
    const unrelated = document({ id: "ocean", title: "海洋潮汐观测", category: "自然科学", tags: ["海洋", "潮汐"], content: "深海潮汐和海水温度观测记录。" });
    const question = "公司电脑怎么申请？";
    const direct = createRetriever("auto").retrieve({ query: question, documents: [unrelated], scenario: "enterprise", topK: 4 });
    const result = runRagTestDiagnostic(question, [unrelated], "ocean");
    expect(result.reliableSourceCount).toBe(0);
    expect(result.retrievalConfidence).toBe("low");
    expect(result.candidateCount).toBe(direct.metadata.candidateCount);
  });

  it("records only 50 lightweight history records and safely recovers from corrupt data", () => {
    const storage = installLocalStorage();
    const diagnostic = runRagTestDiagnostic("公司电脑怎么申请？", [document()], "laptop-policy");
    for (let index = 0; index < 55; index += 1) saveRagTestHistoryItem({ ...diagnostic, question: `测试问题 ${index}` });
    expect(loadRagTestHistory().data).toHaveLength(50);
    storage.set(RAG_TEST_HISTORY_STORAGE_KEY, "{");
    expect(loadRagTestHistory()).toMatchObject({ ok: false, data: [] });
  });
});
