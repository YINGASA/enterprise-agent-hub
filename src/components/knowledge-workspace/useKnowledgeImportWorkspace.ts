"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { knowledgeImportLimits, SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS } from "@/lib/knowledge/import-limits";
import {
  KnowledgeImportRepositoryError,
  ServerKnowledgeImportRepository,
  type KnowledgeImportRepository,
} from "@/lib/storage/knowledgeImportRepository";
import {
  ServerKnowledgePackRepository,
  type KnowledgePackRepository,
} from "@/lib/storage/knowledgePackRepository";
import type { PublicStorageStatus } from "@/lib/storage/status";
import type {
  KnowledgeConflictResolution,
  KnowledgeImportJob,
  KnowledgeImportJobItemConfirmation,
  KnowledgeImportPreviewMetadata,
  WorkspaceKnowledgePack,
} from "@/types";

const activeJobStorageKey = "enterprise-agent-hub:active-knowledge-import-job:v1";
const terminalStatuses = new Set(["completed", "partial_failed", "failed", "cancelled"]);
const recoverableStatuses = new Set(["preview_ready", "pending", "processing", "partial_failed", "failed"]);
const acceptedMimeTypes: Record<string, ReadonlySet<string>> = {
  ".txt": new Set(["", "application/octet-stream", "text/plain"]),
  ".md": new Set(["", "application/octet-stream", "text/plain", "text/markdown", "text/x-markdown"]),
  ".pdf": new Set(["", "application/octet-stream", "application/pdf"]),
  ".docx": new Set(["", "application/octet-stream", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
};

export type KnowledgeImportFileValidation = { ok: true; files: File[] } | { ok: false; message: string };

export function createKnowledgeImportIdempotencyKey(generateUuid = () => globalThis.crypto.randomUUID()) {
  return `knowledge-import-${generateUuid()}`;
}

export function validateKnowledgeImportFiles(input: readonly File[]): KnowledgeImportFileValidation {
  const files = Array.from(input);
  if (!files.length) return { ok: false, message: "请选择至少一个文件。" };
  if (files.length > knowledgeImportLimits.maximumBatchFiles) {
    return { ok: false, message: `单批最多选择 ${knowledgeImportLimits.maximumBatchFiles} 个文件。` };
  }
  let totalBytes = 0;
  for (const file of files) {
    if (!file.name || file.name.length > knowledgeImportLimits.maximumFileNameCharacters || /[\\/]/.test(file.name)) {
      return { ok: false, message: "文件名无效或过长。" };
    }
    if (file.size <= 0) return { ok: false, message: `${file.name} 是空文件。` };
    if (file.size > knowledgeImportLimits.maximumFileBytes) {
      return { ok: false, message: `${file.name} 超过单文件 5MB 限制。` };
    }
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS.includes(extension as (typeof SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS)[number])) {
      return { ok: false, message: `${file.name} 不是支持的 TXT、Markdown、PDF 或 DOCX 文件。` };
    }
    if (!acceptedMimeTypes[extension]?.has(file.type.toLowerCase())) {
      return { ok: false, message: `${file.name} 的扩展名与文件类型不一致。` };
    }
    totalBytes += file.size;
  }
  if (totalBytes > knowledgeImportLimits.maximumBatchBytes) return { ok: false, message: "单批文件总大小不能超过 25MB。" };
  return { ok: true, files };
}

export function isTerminalKnowledgeImportJob(job?: Pick<KnowledgeImportJob, "status"> | null) {
  return Boolean(job && terminalStatuses.has(job.status));
}

export function shouldContinueKnowledgeImportJob<T extends Pick<KnowledgeImportJob, "status">>(job?: T | null): job is T {
  return Boolean(job && (job.status === "pending" || job.status === "processing"));
}

export async function resolveKnowledgeImportRecovery(
  repository: KnowledgeImportRepository,
  rememberedId: string | null,
  signal?: AbortSignal,
) {
  const normalizedId = rememberedId?.trim();
  let rememberedTerminal: KnowledgeImportJob | null = null;
  if (normalizedId && normalizedId.length <= 128) {
    try {
      const remembered = await repository.getJob(normalizedId, signal);
      if (remembered && recoverableStatuses.has(remembered.status)) return remembered;
      rememberedTerminal = remembered;
    } catch (error) {
      if (!(error instanceof KnowledgeImportRepositoryError) || (error.status !== 400 && error.status !== 404)) throw error;
    }
  }
  const discovered = await repository.listRecoverableJobs(signal);
  return discovered.find((job) => recoverableStatuses.has(job.status)) ?? rememberedTerminal;
}

export function buildKnowledgeImportConfirmations(job: KnowledgeImportJob): KnowledgeImportJobItemConfirmation[] {
  return job.items.filter((item) => item.status === "preview_ready").map((item) => ({
    itemId: item.id,
    expectedRevision: item.revision,
    metadata: item.metadata,
    conflictResolution: item.conflictResolution ?? (item.duplicateType === "none" ? "import_as_new" : "skip"),
  }));
}

type Options = {
  storageStatus: PublicStorageStatus | null;
  onImportComplete?: (job: KnowledgeImportJob) => void | Promise<void>;
  importRepository?: KnowledgeImportRepository;
  packRepository?: KnowledgePackRepository;
};

export function useKnowledgeImportWorkspace({
  storageStatus,
  onImportComplete,
  importRepository: suppliedImportRepository,
  packRepository: suppliedPackRepository,
}: Options) {
  const importRepository = useMemo(() => suppliedImportRepository ?? new ServerKnowledgeImportRepository(), [suppliedImportRepository]);
  const packRepository = useMemo(() => suppliedPackRepository ?? new ServerKnowledgePackRepository(), [suppliedPackRepository]);
  const activeRequest = useRef<AbortController | null>(null);
  const previewIdempotencyKey = useRef("");
  const mounted = useRef(true);
  const onImportCompleteRef = useRef(onImportComplete);
  const [packs, setPacks] = useState<WorkspaceKnowledgePack[]>([]);
  const [activeJob, setActiveJob] = useState<KnowledgeImportJob | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [knowledgePackId, setKnowledgePackId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    onImportCompleteRef.current = onImportComplete;
  }, [onImportComplete]);

  const requireServer = useCallback(() => {
    if (!storageStatus) throw new Error("正在检查存储状态，请稍后再试。");
    if (storageStatus.storageMode === "local") throw new Error("企业知识包和批量导入需要启用服务端存储。");
    if (storageStatus.storageMode === "degraded") throw new Error("服务端暂不可用，当前不能启动或推进导入任务。");
  }, [storageStatus]);

  const rememberJob = useCallback((job: KnowledgeImportJob | null) => {
    setActiveJob(job);
    if (typeof window === "undefined") return;
    if (job) window.sessionStorage.setItem(activeJobStorageKey, job.id);
    else window.sessionStorage.removeItem(activeJobStorageKey);
  }, []);

  const processUntilSettled = useCallback(async (initial: KnowledgeImportJob, signal: AbortSignal) => {
    let current = initial;
    const maximumSteps = Math.max(current.totalItems + current.failedItems + 2, 2);
    for (let step = 0; step < maximumSteps && !signal.aborted && shouldContinueKnowledgeImportJob(current); step += 1) {
      const previousRevision = current.revision;
      current = await importRepository.processNext(current.id, current.revision, signal);
      if (signal.aborted) return current;
      rememberJob(current);
      if (current.revision === previousRevision && shouldContinueKnowledgeImportJob(current)) break;
    }
    if (isTerminalKnowledgeImportJob(current)) {
      setNotice(`导入结果：成功 ${current.completedItems}，跳过 ${current.skippedItems}，冲突 ${current.conflictedItems}，失败 ${current.failedItems}。`);
      await onImportCompleteRef.current?.(current);
    }
    return current;
  }, [importRepository, rememberJob]);

  const run = useCallback(async <T,>(operation: (signal: AbortSignal) => Promise<T>) => {
    requireServer();
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setError("");
    try {
      return await operation(controller.signal);
    } catch (operationError) {
      if (!(operationError instanceof DOMException && operationError.name === "AbortError")) {
        setError(operationError instanceof Error ? operationError.message : "企业知识导入请求失败。");
      }
      throw operationError;
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }, [requireServer]);

  const refresh = useCallback(async () => {
    if (storageStatus?.storageMode !== "server") return;
    await run(async (signal) => {
      const nextPacks = await packRepository.list();
      if (!mounted.current || signal.aborted) return;
      setPacks(nextPacks);
      const rememberedId = typeof window === "undefined" ? null : window.sessionStorage.getItem(activeJobStorageKey);
      const job = await resolveKnowledgeImportRecovery(importRepository, rememberedId, signal);
      if (!mounted.current || signal.aborted) return;
      rememberJob(job);
      if (shouldContinueKnowledgeImportJob(job)) {
        await processUntilSettled(job, signal);
      }
    }).catch(() => undefined);
  }, [importRepository, packRepository, processUntilSettled, rememberJob, run, storageStatus?.storageMode]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
    };
  }, [refresh]);

  const chooseFiles = useCallback((input: readonly File[]) => {
    const validation = validateKnowledgeImportFiles(input);
    if (!validation.ok) {
      setFiles([]);
      previewIdempotencyKey.current = "";
      setError(validation.message);
      return false;
    }
    setFiles(validation.files);
    previewIdempotencyKey.current = createKnowledgeImportIdempotencyKey();
    setError("");
    setNotice(`已选择 ${validation.files.length} 个文件，尚未上传。`);
    return true;
  }, []);

  const preview = useCallback(async () => {
    const validation = validateKnowledgeImportFiles(files);
    if (!validation.ok) { setError(validation.message); return; }
    if (!previewIdempotencyKey.current) previewIdempotencyKey.current = createKnowledgeImportIdempotencyKey();
    await run(async (signal) => {
      const job = await importRepository.preview({
        files: validation.files,
        knowledgePackId: knowledgePackId || undefined,
        idempotencyKey: previewIdempotencyKey.current,
        signal,
      });
      if (signal.aborted) return;
      rememberJob(job);
      setFiles([]);
      setNotice(`预览完成：共 ${job.totalItems} 个文件。原始文件不会长期保存。`);
    }).catch(() => undefined);
  }, [files, importRepository, knowledgePackId, rememberJob, run]);

  const updateItemMetadata = useCallback((itemId: string, update: Partial<KnowledgeImportPreviewMetadata>) => {
    setActiveJob((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, metadata: { ...item.metadata, ...update } } : item),
    } : current);
  }, []);

  const updateConflictResolution = useCallback((itemId: string, resolution: KnowledgeConflictResolution) => {
    setActiveJob((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, conflictResolution: resolution } : item),
    } : current);
  }, []);

  const confirmAndProcess = useCallback(async () => {
    if (!activeJob) return;
    await run(async (signal) => {
      const confirmed = await importRepository.createJob({
        jobId: activeJob.id,
        expectedRevision: activeJob.revision,
        knowledgePackId: knowledgePackId || activeJob.knowledgePackId,
        items: buildKnowledgeImportConfirmations(activeJob),
        signal,
      });
      rememberJob(confirmed);
      await processUntilSettled(confirmed, signal);
    }).catch(() => undefined);
  }, [activeJob, importRepository, knowledgePackId, processUntilSettled, rememberJob, run]);

  const retryFailed = useCallback(async () => {
    if (!activeJob) return;
    await run(async (signal) => {
      const retrying = await importRepository.retryFailed(activeJob.id, activeJob.revision, signal);
      rememberJob(retrying);
      await processUntilSettled(retrying, signal);
    }).catch(() => undefined);
  }, [activeJob, importRepository, processUntilSettled, rememberJob, run]);

  const cancel = useCallback(async () => {
    if (!activeJob) return;
    activeRequest.current?.abort();
    await run(async (signal) => {
      const cancelled = await importRepository.cancel(activeJob.id, activeJob.revision, signal);
      rememberJob(cancelled);
      setNotice("导入任务已取消，已成功导入的独立文档不会被删除。");
    }).catch(() => undefined);
  }, [activeJob, importRepository, rememberJob, run]);

  const createPack = useCallback(async (name: string, description?: string) => {
    return run(async (signal) => {
      const created = await packRepository.create({ name, ...(description ? { description } : {}) });
      if (signal.aborted || !mounted.current) return created;
      setPacks((current) => [created, ...current.filter((pack) => pack.id !== created.id)]);
      setNotice(`已创建企业知识包：${created.name}`);
      return created;
    });
  }, [packRepository, run]);

  const updatePack = useCallback(async (pack: WorkspaceKnowledgePack, input: { name?: string; description?: string | null }) => {
    return run(async (signal) => {
      const updated = await packRepository.update(pack.id, { expectedRevision: pack.revision, ...input });
      if (signal.aborted || !mounted.current) return updated;
      setPacks((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`已更新企业知识包：${updated.name}`);
      return updated;
    });
  }, [packRepository, run]);

  const removePack = useCallback(async (pack: WorkspaceKnowledgePack) => {
    return run(async (signal) => {
      await packRepository.remove(pack.id, { expectedRevision: pack.revision });
      if (signal.aborted || !mounted.current) return;
      setPacks((current) => current.filter((item) => item.id !== pack.id));
      if (knowledgePackId === pack.id) setKnowledgePackId("");
      setNotice(`已删除企业知识包：${pack.name}。包内文档已保留。`);
    });
  }, [knowledgePackId, packRepository, run]);

  return {
    storageStatus, packs, activeJob, files, knowledgePackId, busy, error, notice,
    setKnowledgePackId, chooseFiles, preview, refresh, updateItemMetadata, updateConflictResolution,
    confirmAndProcess, retryFailed, cancel, createPack, updatePack, removePack,
  };
}

export type KnowledgeImportWorkspaceController = ReturnType<typeof useKnowledgeImportWorkspace>;
