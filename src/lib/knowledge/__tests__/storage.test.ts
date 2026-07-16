import { afterEach, describe, expect, it } from "vitest";
import { agentRequestLimits } from "@/lib/ops/securityLimits";
import {
  USER_KNOWLEDGE_STORAGE_KEY,
  applyKnowledgeBackup,
  createKnowledgeBackup,
  deleteUserKnowledgeDocument,
  previewKnowledgeBackup,
  readUserKnowledgeDocumentsWithStatus,
  writeUserKnowledgeDocuments,
} from "@/lib/knowledge/storage";
import { clearKnowledgeDerivedCache, getKnowledgeDerived, invalidateKnowledgeDerived } from "@/lib/knowledge/derived";
import type { ImportedKnowledgeDocument } from "@/types";

function document(overrides: Partial<ImportedKnowledgeDocument> = {}): ImportedKnowledgeDocument {
  return {
    id: "laptop-policy",
    title: "Laptop application policy",
    category: "IT policy",
    tags: ["laptop", "application"],
    summary: "How employees request company laptops.",
    content: "Employees request a company laptop through the IT service portal. Their manager approves the request before IT prepares the device.",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sourceType: "user_paste",
    importedAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
    isDefault: false,
    suggestedQuestions: ["Who can apply for a company laptop?"],
    ...overrides,
  };
}

function installLocalStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        removeItem: (key: string) => data.delete(key),
      },
    },
  });
  return data;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  clearKnowledgeDerivedCache();
});

describe("knowledge storage V2", () => {
  it("migrates a legacy array into the V2 envelope", () => {
    const storage = installLocalStorage();
    storage.set(USER_KNOWLEDGE_STORAGE_KEY, JSON.stringify([document()]));

    const result = readUserKnowledgeDocumentsWithStatus();

    expect(result).toMatchObject({ ok: true, data: [expect.objectContaining({ id: "laptop-policy" })] });
    expect(JSON.parse(storage.get(USER_KNOWLEDGE_STORAGE_KEY) ?? "{}")).toMatchObject({ version: 2, documents: [expect.objectContaining({ id: "laptop-policy" })] });
  });

  it("reads the current V2 envelope and safely recovers from malformed JSON", () => {
    const storage = installLocalStorage();
    storage.set(USER_KNOWLEDGE_STORAGE_KEY, JSON.stringify({ version: 2, updatedAt: "2026-01-01T00:00:00.000Z", documents: [document()] }));
    expect(readUserKnowledgeDocumentsWithStatus()).toMatchObject({ ok: true, data: [expect.objectContaining({ title: "Laptop application policy" })] });

    storage.set(USER_KNOWLEDGE_STORAGE_KEY, "{");
    expect(readUserKnowledgeDocumentsWithStatus()).toMatchObject({ ok: false, data: [] });
  });

  it("filters invalid restored records without discarding valid records", () => {
    const storage = installLocalStorage();
    storage.set(USER_KNOWLEDGE_STORAGE_KEY, JSON.stringify({ version: 2, documents: [document(), { id: "bad", title: "Missing content", sourceType: "user_paste" }] }));

    const result = readUserKnowledgeDocumentsWithStatus();

    expect(result).toMatchObject({ ok: true, data: [expect.objectContaining({ id: "laptop-policy" })] });
    expect(result.notice).toContain("1");
  });

  it("preserves user-provided recruitment content without treating it as a retired built-in scenario", () => {
    const storage = installLocalStorage();
    const userDocument = document({
      id: "user-hiring-policy",
      title: "用户自定义招聘制度",
      category: "用户导入",
      tags: ["招聘", "面试"],
      content: "这是用户自行导入的企业招聘制度，包含候选人面试材料和内部审批要求。",
      packId: "enterprise-policy",
      enabled: true,
      sourceType: "user_paste",
    });

    expect(writeUserKnowledgeDocuments([userDocument])).toMatchObject({ ok: true });
    expect(readUserKnowledgeDocumentsWithStatus().data).toEqual([
      expect.objectContaining({
        id: "user-hiring-policy",
        title: "用户自定义招聘制度",
        enabled: true,
        sourceType: "user_paste",
      }),
    ]);
    expect(storage.get(USER_KNOWLEDGE_STORAGE_KEY)).toContain("用户自定义招聘制度");
  });

  it("rejects document count, tag and content values beyond shared limits", () => {
    installLocalStorage();
    const tooMany = Array.from({ length: agentRequestLimits.userDocuments + 1 }, (_, index) => document({ id: `doc-${index}` }));
    expect(writeUserKnowledgeDocuments(tooMany)).toMatchObject({ ok: false });
    expect(writeUserKnowledgeDocuments([document({ tags: Array.from({ length: agentRequestLimits.documentTags + 1 }, (_, index) => `tag-${index}`) })])).toMatchObject({ ok: false });
    expect(writeUserKnowledgeDocuments([document({ content: "x".repeat(agentRequestLimits.documentContentChars + 1) })])).toMatchObject({ ok: false });
  });

  it("exports only the user knowledge backup schema", () => {
    const backup = createKnowledgeBackup([document({ source: "private location", owner: "private owner" })]);
    const serialized = JSON.stringify(backup);

    expect(backup).toMatchObject({ version: 2, documents: [expect.objectContaining({ id: "laptop-policy", enabled: true })] });
    expect(serialized).not.toContain("private location");
    expect(serialized).not.toContain("private owner");
    expect(serialized).not.toMatch(/api[_-]?key|provider|baseUrl/i);
  });

  it("previews merge additions, duplicates and conflicts before applying", () => {
    installLocalStorage();
    const existing = [document()];
    const newDocument = document({ id: "expense-policy", title: "Expense policy", content: "Travel expense claims require receipts and approval." });
    const sameContent = document({ id: "same-content", title: "Laptop application policy" });
    const conflictingId = document({ title: "Changed laptop policy", content: "Different content." });
    const raw = JSON.stringify({ version: 2, exportedAt: "2026-01-01T00:00:00.000Z", documents: [newDocument, sameContent, conflictingId] });

    const preview = previewKnowledgeBackup(raw, existing, "merge");

    expect(preview).toMatchObject({ ok: true, counts: { new: 1, duplicate: 1, conflict: 1 } });
    expect(applyKnowledgeBackup(existing, preview, "merge")).toMatchObject({ ok: true, data: expect.arrayContaining([expect.objectContaining({ id: "expense-policy" })]) });
  });

  it("replaces only with a valid backup and rejects invalid backup JSON", () => {
    installLocalStorage();
    const replacement = document({ id: "replacement", title: "Replacement", content: "Replacement policy content." });
    const preview = previewKnowledgeBackup(JSON.stringify({ version: 2, exportedAt: "2026-01-01T00:00:00.000Z", documents: [replacement] }), [document()], "replace");
    expect(preview.ok).toBe(true);
    expect(applyKnowledgeBackup([document()], preview, "replace")).toMatchObject({ ok: true, data: [expect.objectContaining({ id: "replacement" })] });
    expect(previewKnowledgeBackup("not-json", [], "merge").ok).toBe(false);
  });
});

describe("knowledge derived cache", () => {
  it("reuses derived values until the document update marker changes", () => {
    const first = document();
    const firstDerived = getKnowledgeDerived(first);
    expect(getKnowledgeDerived(first)).toBe(firstDerived);

    const updated = { ...first, updatedAt: "2026-01-02T00:00:00.000Z" };
    expect(getKnowledgeDerived(updated)).not.toBe(firstDerived);
  });

  it("clears cached values after explicit document invalidation", () => {
    const source = document();
    const first = getKnowledgeDerived(source);
    invalidateKnowledgeDerived(source.id);
    expect(getKnowledgeDerived(source)).not.toBe(first);
  });

  it("clears a deleted document cache through the storage adapter", () => {
    installLocalStorage();
    const source = document();
    const first = getKnowledgeDerived(source);
    expect(deleteUserKnowledgeDocument([source], source.id).ok).toBe(true);
    expect(getKnowledgeDerived(source)).not.toBe(first);
  });
});
