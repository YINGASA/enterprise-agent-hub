import { expect, test, type Page, type Route } from "@playwright/test";

const fixedNow = "2026-07-18T08:00:00.000Z";

type Pack = {
  id: string;
  name: string;
  description?: string;
  status: "active";
  documentCount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

type ImportItem = {
  id: string;
  importJobId: string;
  itemIndex: number;
  originalFileName: string;
  normalizedTitle: string;
  mimeType: string;
  sizeBytes: number;
  status: "preview_ready" | "ready" | "completed" | "failed";
  duplicateType: "none" | "same_title";
  conflictDocumentId?: string;
  conflictResolution?: "skip" | "replace" | "import_as_new";
  extractedCharacterCount: number;
  estimatedChunkCount: number;
  checksumStatus: "computed";
  qualityLevel: "excellent" | "usable" | "needs_attention";
  qualityLabel: "优秀" | "可用" | "需处理";
  warnings: string[];
  metadata: {
    title: string;
    category: string;
    tags: string[];
    sourceType: "user_upload";
    enabled: boolean;
    suggestedQuestions: string[];
    knowledgePackId?: string;
    metadata: Record<string, unknown>;
  };
  chunkPreview: Array<{
    chunkIndex: number;
    characterCount: number;
    approximateTokens: number;
    keywords: string[];
    contentPreview: string;
    tooShort: boolean;
    tooLong: boolean;
    possibleDuplicate: boolean;
    lowInformation: boolean;
    qualityLevel: "excellent" | "usable" | "needs_attention";
  }>;
  documentId?: string;
  errorCode?: string;
  errorMessageSafe?: string;
  retryCount: number;
  retryable?: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

type ImportJob = {
  id: string;
  knowledgePackId?: string;
  status: "preview_ready" | "pending" | "processing" | "completed" | "partial_failed";
  totalItems: number;
  completedItems: number;
  failedItems: number;
  skippedItems: number;
  conflictedItems: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  items: ImportItem[];
};

type KnowledgeDocument = {
  id: string;
  knowledgePackId: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sourceType: "user_upload";
  isDefault: false;
  importedAt: string;
  enabled: boolean;
  suggestedQuestions: string[];
  originalFileName: string;
};

type MockState = {
  packs: Pack[];
  job: ImportJob | null;
  documents: KnowledgeDocument[];
  processCalls: number;
  retryCalls: number;
  packDeleteCalls?: number;
  previewBody: string;
  confirmationBody?: Record<string, unknown>;
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

function makeItem(index: number, duplicateType: ImportItem["duplicateType"]): ImportItem {
  const fileName = index === 0 ? "employee-policy.txt" : "travel-policy.md";
  const title = index === 0 ? "员工制度" : "差旅制度";
  return {
    id: `item-${index + 1}`,
    importJobId: "job-1",
    itemIndex: index,
    originalFileName: fileName,
    normalizedTitle: title,
    mimeType: index === 0 ? "text/plain" : "text/markdown",
    sizeBytes: 256,
    status: "preview_ready",
    duplicateType,
    ...(duplicateType === "same_title" ? { conflictDocumentId: "existing-travel-policy" } : {}),
    extractedCharacterCount: 220,
    estimatedChunkCount: index === 0 ? 2 : 1,
    checksumStatus: "computed",
    qualityLevel: index === 0 ? "excellent" : "usable",
    qualityLabel: index === 0 ? "优秀" : "可用",
    warnings: index === 0 ? [] : ["检测到同名文档，请确认冲突处理方式。"],
    metadata: {
      title,
      category: "企业制度",
      tags: ["制度"],
      sourceType: "user_upload",
      enabled: true,
      suggestedQuestions: [],
      knowledgePackId: "pack-1",
      metadata: {},
    },
    chunkPreview: [
      {
        chunkIndex: 0,
        characterCount: 120,
        approximateTokens: 60,
        keywords: ["制度", "员工", "差旅"],
        contentPreview: `${title}的第一段受限分块预览，不包含完整文件正文。`,
        tooShort: false,
        tooLong: false,
        possibleDuplicate: duplicateType !== "none",
        lowInformation: false,
        qualityLevel: index === 0 ? "excellent" : "usable",
      },
      ...(index === 0 ? [{
        chunkIndex: 1,
        characterCount: 100,
        approximateTokens: 50,
        keywords: ["审批", "流程"],
        contentPreview: `${title}的第二段受限分块预览，用于验证分块导航。`,
        tooShort: false,
        tooLong: false,
        possibleDuplicate: false,
        lowInformation: false,
        qualityLevel: "excellent" as const,
      }] : []),
    ],
    retryCount: 0,
    revision: 0,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  };
}

function previewJob(): ImportJob {
  return {
    id: "job-1",
    knowledgePackId: "pack-1",
    status: "preview_ready",
    totalItems: 2,
    completedItems: 0,
    failedItems: 0,
    skippedItems: 0,
    conflictedItems: 1,
    revision: 0,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    items: [makeItem(0, "none"), makeItem(1, "same_title")],
  };
}

function importedDocument(item: ImportItem): KnowledgeDocument {
  return {
    id: item.documentId ?? `document-${item.id}`,
    knowledgePackId: "pack-1",
    title: item.metadata.title,
    category: item.metadata.category,
    tags: item.metadata.tags,
    summary: "企业知识包 E2E 导入结果",
    content: `${item.metadata.title}用于验证服务端批量导入完成后刷新仍可读取，并可进入当前工作区检索。`,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    sourceType: "user_upload",
    isDefault: false,
    importedAt: fixedNow,
    enabled: item.metadata.enabled,
    suggestedQuestions: item.metadata.suggestedQuestions,
    originalFileName: item.originalFileName,
  };
}

async function installKnowledgeImportApi(page: Page, state: MockState) {
  await page.route("**/api/storage/status", (route) => json(route, {
    configured: true,
    healthy: true,
    storageMode: "server",
    databaseType: "postgresql",
  }));

  await page.route("**/api/storage/knowledge**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path === "/api/storage/knowledge" && method === "GET") {
      return json(route, { documents: structuredClone(state.documents) });
    }
    if (path === "/api/storage/knowledge/packs" && method === "GET") {
      return json(route, { packs: structuredClone(state.packs) });
    }
    if (path === "/api/storage/knowledge/packs" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as { name?: string; description?: string };
      const pack: Pack = {
        id: "pack-1",
        name: body.name ?? "未命名知识包",
        ...(body.description ? { description: body.description } : {}),
        status: "active",
        documentCount: 0,
        revision: 0,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };
      state.packs = [pack];
      return json(route, { pack }, 201);
    }
    if (path === "/api/storage/knowledge/packs/pack-1" && method === "DELETE") {
      state.packDeleteCalls = (state.packDeleteCalls ?? 0) + 1;
      state.packs = [];
      return json(route, { result: { detachedDocumentCount: state.documents.length, deletedDocumentCount: 0 } });
    }
    if (path === "/api/storage/knowledge/import/preview" && method === "POST") {
      state.previewBody = request.postDataBuffer()?.toString("utf8") ?? "";
      state.job = previewJob();
      return json(route, { ok: true, job: structuredClone(state.job) }, 201);
    }
    if (path === "/api/storage/knowledge/import/jobs" && method === "POST") {
      state.confirmationBody = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      if (!state.job) return json(route, { error: "knowledge_import_not_found", message: "导入任务不存在。" }, 404);
      const confirmations = Array.isArray(state.confirmationBody.items) ? state.confirmationBody.items as Array<Record<string, unknown>> : [];
      state.job.items = state.job.items.map((item) => {
        const confirmation = confirmations.find((entry) => entry.itemId === item.id);
        return {
          ...item,
          status: "ready",
          conflictResolution: confirmation?.conflictResolution as ImportItem["conflictResolution"],
          metadata: confirmation?.metadata as ImportItem["metadata"] ?? item.metadata,
          revision: item.revision + 1,
        };
      });
      state.job.status = "pending";
      state.job.revision += 1;
      return json(route, { ok: true, job: structuredClone(state.job) });
    }
    if (path === "/api/storage/knowledge/import/jobs" && method === "GET") {
      const recoverableStatuses = new Set(["preview_ready", "pending", "processing", "partial_failed", "failed"]);
      const jobs = state.job && recoverableStatuses.has(state.job.status) ? [structuredClone(state.job)] : [];
      return json(route, { ok: true, jobs });
    }
    if (path === "/api/storage/knowledge/import/jobs/job-1" && method === "GET") {
      return state.job
        ? json(route, { ok: true, job: structuredClone(state.job) })
        : json(route, { error: "knowledge_import_not_found", message: "导入任务不存在。" }, 404);
    }
    if (path === "/api/storage/knowledge/import/jobs/job-1/process" && method === "POST") {
      if (!state.job) return json(route, { error: "knowledge_import_not_found", message: "导入任务不存在。" }, 404);
      state.processCalls += 1;
      const ready = state.job.items.find((item) => item.status === "ready");
      if (ready?.id === "item-1") {
        ready.status = "completed";
        ready.documentId = "document-item-1";
        ready.revision += 1;
        state.documents.push(importedDocument(ready));
        state.job.completedItems = 1;
        state.job.status = "processing";
      } else if (ready?.id === "item-2" && state.retryCalls === 0) {
        ready.status = "failed";
        ready.errorCode = "knowledge_import_item_failed";
        ready.errorMessageSafe = "测试文件首次处理失败，可安全重试。";
        ready.retryable = true;
        ready.revision += 1;
        state.job.failedItems = 1;
        state.job.status = "partial_failed";
        state.job.completedAt = fixedNow;
      } else if (ready?.id === "item-2") {
        ready.status = "completed";
        ready.documentId = "document-item-2";
        ready.retryable = false;
        ready.errorCode = undefined;
        ready.errorMessageSafe = undefined;
        ready.revision += 1;
        state.documents.push(importedDocument(ready));
        state.job.completedItems = 2;
        state.job.failedItems = 0;
        state.job.status = "completed";
        state.job.completedAt = fixedNow;
        state.packs[0]!.documentCount = 2;
      }
      state.job.revision += 1;
      state.job.updatedAt = fixedNow;
      return json(route, { ok: true, job: structuredClone(state.job) });
    }
    if (path === "/api/storage/knowledge/import/jobs/job-1/retry" && method === "POST") {
      if (!state.job) return json(route, { error: "knowledge_import_not_found", message: "导入任务不存在。" }, 404);
      state.retryCalls += 1;
      state.job.items = state.job.items.map((item) => item.status === "failed" ? {
        ...item,
        status: "ready",
        retryCount: item.retryCount + 1,
        retryable: false,
        errorCode: undefined,
        errorMessageSafe: undefined,
        revision: item.revision + 1,
      } : item);
      state.job.status = "pending";
      state.job.failedItems = 0;
      state.job.completedAt = undefined;
      state.job.revision += 1;
      return json(route, { ok: true, job: structuredClone(state.job) });
    }
    return json(route, { error: "not_found", message: "测试接口不存在。" }, 404);
  });
}

test("local 模式保留单文档能力，并明确限制企业批量导入", async ({ page }) => {
  await page.goto("/knowledge");
  await expect(page.getByTestId("storage-status")).toContainText("本地存储");
  await expect(page.getByTestId("knowledge-pack-panel")).toContainText("企业知识包需要服务端存储");
  await expect(page.getByTestId("knowledge-batch-import")).toContainText("批量导入需要服务端存储");
  await expect(page.getByTestId("knowledge-import-files")).toHaveCount(0);

  await page.getByTestId("knowledge-document-title").fill("V2.2.1 本地兼容文档");
  await page.getByTestId("knowledge-document-content").fill("服务端未启用时，原有单文档本地知识导入和本地 RAG 仍然保持可用。");
  await page.getByTestId("knowledge-document-submit").click();
  await expect(page.getByText("V2.2.1 本地兼容文档", { exact: true }).first()).toBeVisible();
});

test("degraded 模式不会开放正式知识包与批量导入写操作", async ({ page }) => {
  await page.route("**/api/storage/status", (route) => json(route, {
    configured: true,
    healthy: false,
    storageMode: "degraded",
    databaseType: "postgresql",
  }));
  await page.goto("/knowledge");
  await expect(page.getByTestId("knowledge-pack-panel")).toContainText("服务端暂不可用");
  await expect(page.getByTestId("knowledge-batch-import")).toContainText("不能启动或推进导入任务");
  await expect(page.getByTestId("knowledge-pack-create")).toHaveCount(0);
  await expect(page.getByTestId("knowledge-import-files")).toHaveCount(0);
});

test("server 模式完成知识包、多文件预览、元数据编辑、失败重试与刷新恢复", async ({ page }) => {
  const state: MockState = { packs: [], job: null, documents: [], processCalls: 0, retryCalls: 0, previewBody: "" };
  await installKnowledgeImportApi(page, state);
  await page.goto("/knowledge");

  await page.getByTestId("knowledge-pack-name").fill("员工制度包");
  await page.getByTestId("knowledge-pack-create").click();
  await expect(page.getByTestId("knowledge-pack-pack-1")).toContainText("员工制度包");

  await page.getByTestId("knowledge-import-pack").selectOption("pack-1");
  const selectedFiles = [
    { name: "employee-policy.txt", mimeType: "text/plain", buffer: Buffer.from("员工制度测试正文。".repeat(20)) },
    { name: "travel-policy.md", mimeType: "text/markdown", buffer: Buffer.from("# 差旅制度\n\n差旅申请与报销规则。".repeat(20)) },
  ];
  const fileInput = page.getByTestId("knowledge-import-files");
  await fileInput.setInputFiles(selectedFiles);
  await expect(page.getByRole("list", { name: "已选择 2 个文件" })).toBeVisible();
  await page.getByRole("button", { name: "移除 travel-policy.md", exact: true }).click();
  await expect(page.getByRole("list", { name: "已选择 1 个文件" })).toBeVisible();
  await expect(page.getByRole("button", { name: "移除 travel-policy.md", exact: true })).toHaveCount(0);
  await fileInput.setInputFiles(selectedFiles);
  await expect(page.getByRole("list", { name: "已选择 2 个文件" })).toBeVisible();
  await page.getByTestId("knowledge-import-preview").click();

  await expect(page.getByTestId("knowledge-import-item-item-1")).toContainText("无重复");
  await expect(page.getByTestId("knowledge-import-item-item-1")).toContainText("优秀");
  await expect(page.getByTestId("knowledge-import-item-item-2")).toContainText("标题相同");
  await expect(page.getByTestId("knowledge-import-item-item-2")).toContainText("检测到同名文档");
  expect(state.previewBody).toContain("employee-policy.txt");
  expect(state.previewBody).toContain("travel-policy.md");

  const firstItem = page.getByTestId("knowledge-import-item-item-1");
  await firstItem.locator("input").first().fill("员工制度（已编辑）");
  await firstItem.getByText("查看分块预览", { exact: false }).click();
  await expect(firstItem.getByTestId("knowledge-import-chunk-item-1-0")).toContainText("第一段受限分块预览");
  await firstItem.getByRole("button", { name: "employee-policy.txt 下一个分块", exact: true }).click();
  await expect(firstItem.getByTestId("knowledge-import-chunk-item-1-1")).toContainText("第二段受限分块预览");
  await firstItem.getByRole("button", { name: "employee-policy.txt 上一个分块", exact: true }).click();
  await expect(firstItem.getByTestId("knowledge-import-chunk-item-1-0")).toBeVisible();
  const secondItem = page.getByTestId("knowledge-import-item-item-2");
  await expect(firstItem.getByLabel("employee-policy.txt 冲突处理", { exact: true })).toBeVisible();
  await secondItem.getByLabel("travel-policy.md 冲突处理", { exact: true }).selectOption("import_as_new");

  await page.getByTestId("knowledge-import-confirm").click();
  await expect(page.getByTestId("knowledge-import-notice")).toContainText("成功 1");
  await expect(page.getByTestId("knowledge-import-notice")).toContainText("失败 1");
  await expect(page.getByTestId("knowledge-import-retry")).toBeVisible();
  expect(JSON.stringify(state.confirmationBody)).toContain("员工制度（已编辑）");
  expect(JSON.stringify(state.confirmationBody)).toContain("import_as_new");

  await page.evaluate(() => window.sessionStorage.clear());
  await page.reload();
  await expect(page.getByTestId("knowledge-import-retry")).toBeVisible();

  await page.getByTestId("knowledge-import-retry").click();
  await expect(page.getByTestId("knowledge-import-notice")).toContainText("成功 2");
  await expect(page.getByTestId("knowledge-import-notice")).toContainText("失败 0");
  await expect(page.getByText("员工制度（已编辑）", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("差旅制度", { exact: true }).first()).toBeVisible();
  expect(state.retryCalls).toBe(1);
  expect(state.processCalls).toBe(3);

  await page.reload();
  await expect(page.getByTestId("knowledge-batch-import")).toHaveAttribute("data-status", "completed");
  await expect(page.getByTestId("knowledge-batch-import")).toContainText("成功：2");
  await expect(page.getByText("员工制度（已编辑）", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("差旅制度", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("knowledge-pack-pack-1")).toContainText("2 篇");

  await page.getByTestId("knowledge-pack-pack-1").getByRole("button", { name: "删除并保留文档" }).click();
  const deleteConfirmation = page.getByTestId("conversation-confirm-submit");
  await deleteConfirmation.evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page.getByTestId("conversation-confirm-dialog")).toHaveCount(0);
  await expect(page.getByTestId("knowledge-pack-pack-1")).toHaveCount(0);
  await expect(page.getByText("员工制度（已编辑）", { exact: true }).first()).toBeVisible();
  expect(state.packDeleteCalls).toBe(1);
});
