"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/chat-workspace/ConfirmDialog";
import {
  collectLocalStorageMigration,
  executeLocalStorageMigration,
  hasLocalStorageMigrationData,
  isStorageMigrationComplete,
  previewLocalStorageMigration,
  readStorageMigrationMarker,
  type StorageMigrationPayload,
  type StorageMigrationResult,
} from "@/lib/storage/migrationClient";
import { getClientStorageStatus, type PublicStorageStatus } from "@/lib/storage/status";

type StorageStatusPanelProps = {
  status?: PublicStorageStatus | null;
  className?: string;
  onRetry?: () => void | Promise<void>;
  onMigrationComplete?: (result: StorageMigrationResult) => void | Promise<void>;
};

type MigrationConfirmation =
  | { step: "upload" }
  | { step: "execute"; preview: StorageMigrationResult };

const modeCopy = {
  local: {
    label: "本地存储",
    description: "数据库未配置，当前继续使用此浏览器的本地数据。",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    dot: "bg-slate-400",
  },
  server: {
    label: "服务端存储",
    description: "PostgreSQL 连接正常，数据按当前匿名工作区隔离保存。",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  degraded: {
    label: "服务端暂不可用",
    description: "当前数据仅供查看；写操作不会静默保存到本地，请恢复后重试。",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
  },
} as const;

function resultCopy(result: StorageMigrationResult) {
  return `已导入 ${result.imported}，已跳过 ${result.skipped}，冲突 ${result.conflicted}，失败 ${result.failed}`;
}

export function StorageStatusPanel({ status: providedStatus, className = "", onRetry, onMigrationComplete }: StorageStatusPanelProps) {
  const [status, setStatus] = useState<PublicStorageStatus | null>(providedStatus ?? null);
  const [payload, setPayload] = useState<StorageMigrationPayload | null>(null);
  const [result, setResult] = useState<StorageMigrationResult | null>(null);
  const [completedBefore, setCompletedBefore] = useState(false);
  const [migrationConfirmation, setMigrationConfirmation] = useState<MigrationConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (providedStatus !== undefined) {
      setStatus(providedStatus);
      return () => { active = false; };
    }
    void getClientStorageStatus().then((next) => {
      if (active) setStatus(next);
    });
    return () => { active = false; };
  }, [providedStatus]);

  useEffect(() => {
    const collected = collectLocalStorageMigration();
    const marker = readStorageMigrationMarker();
    setPayload(collected);
    setCompletedBefore(marker?.migrationId === collected.migrationId);
  }, []);

  useEffect(() => {
    if (status?.storageMode !== "server") setMigrationConfirmation(null);
  }, [status?.storageMode]);

  const migrationAvailable = useMemo(() => Boolean(payload && hasLocalStorageMigrationData(payload)), [payload]);

  const closeMigrationConfirmation = useCallback(() => setMigrationConfirmation(null), []);

  const requestMigrationPreview = useCallback(() => {
    if (!payload || !status || status.storageMode !== "server" || busy) return;
    setError("");
    setMigrationConfirmation({ step: "upload" });
  }, [busy, payload, status]);

  const previewMigration = useCallback(async () => {
    if (!payload || !status || status.storageMode !== "server" || busy || migrationConfirmation?.step !== "upload") return;
    setMigrationConfirmation(null);
    setBusy(true);
    setError("");
    try {
      const preview = await previewLocalStorageMigration(payload);
      setMigrationConfirmation({ step: "execute", preview });
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : "数据迁移失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }, [busy, migrationConfirmation, payload, status]);

  const executeMigration = useCallback(async () => {
    if (!payload || !status || status.storageMode !== "server" || busy || migrationConfirmation?.step !== "execute") return;
    setMigrationConfirmation(null);
    setBusy(true);
    setError("");
    try {
      const completed = await executeLocalStorageMigration(payload, true);
      setResult(completed);
      setCompletedBefore(isStorageMigrationComplete(completed));
      if (onMigrationComplete) {
        try {
          await onMigrationComplete(completed);
        } catch (refreshError) {
          setError(`迁移已完成，但页面刷新失败：${refreshError instanceof Error ? refreshError.message : "请手动刷新页面。"}`);
        }
      }
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : "数据迁移失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }, [busy, migrationConfirmation, onMigrationComplete, payload, status]);

  const retry = useCallback(async () => {
    if (retrying || busy) return;
    setRetrying(true);
    setError("");
    try {
      if (onRetry) await onRetry();
      else setStatus(await getClientStorageStatus(true));
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "存储状态检查失败，请稍后重试。");
    } finally {
      setRetrying(false);
    }
  }, [busy, onRetry, retrying]);

  if (!status) {
    return (
      <aside data-testid="storage-status" className={`border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 ${className}`}>
        正在检查存储状态…
      </aside>
    );
  }

  const copy = modeCopy[status.storageMode];
  const migrationDialog = migrationConfirmation?.step === "upload"
    ? {
        title: "确认上传本地数据？",
        description: `迁移预检需要把此浏览器中的 ${payload?.conversations.length ?? 0} 个会话和 ${payload?.knowledgeDocuments.length ?? 0} 篇知识文档（可能包含消息与正文）发送到当前服务端工作区。原 localStorage 数据会保留。`,
        confirmLabel: "允许上传并预检",
      }
    : migrationConfirmation?.step === "execute"
      ? {
          title: "确认执行数据迁移？",
          description: `预检完成：${resultCopy(migrationConfirmation.preview)}。服务端已有记录优先，原 localStorage 数据会完整保留。`,
          confirmLabel: "执行迁移",
        }
      : null;

  return (
    <>
    <aside data-testid="storage-status" className={`border-b px-4 py-2.5 text-xs ${copy.tone} ${className}`} aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${copy.dot}`} />
            {copy.label}
            {status.storageMode === "degraded" ? <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium">只读</span> : null}
          </p>
          <p className="mt-0.5 leading-5 opacity-80">{copy.description}</p>
          {result ? <p className="mt-1 font-medium">迁移结果：{resultCopy(result)}。</p> : null}
          {!result && completedBefore && status.storageMode === "server" ? <p className="mt-1 font-medium">此浏览器已执行过服务端迁移；本地备份仍保留。</p> : null}
          {error ? <p role="alert" className="mt-1 font-medium text-rose-700">{error}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status.storageMode === "degraded" ? (
            <button
              type="button"
              data-testid="storage-status-retry"
              onClick={() => void retry()}
              disabled={retrying || busy}
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
            >
              {retrying ? "正在重试…" : "重试连接"}
            </button>
          ) : null}
          {status.storageMode === "server" && migrationAvailable && !completedBefore ? (
            <button
              type="button"
              onClick={requestMigrationPreview}
              disabled={busy || retrying}
              className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "正在处理…" : "迁移本地数据"}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
      <ConfirmDialog
        open={Boolean(migrationDialog)}
        title={migrationDialog?.title ?? "确认数据迁移"}
        description={migrationDialog?.description ?? ""}
        confirmLabel={migrationDialog?.confirmLabel ?? "确认"}
        onCancel={closeMigrationConfirmation}
        onConfirm={() => {
          if (migrationConfirmation?.step === "upload") void previewMigration();
          else if (migrationConfirmation?.step === "execute") void executeMigration();
        }}
      />
    </>
  );
}
