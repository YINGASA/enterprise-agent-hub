"use client";

import { useRef, useState } from "react";
import type { KnowledgeImportWorkspaceController } from "@/components/knowledge-workspace/useKnowledgeImportWorkspace";
import { SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS } from "@/lib/knowledge/import-limits";
import type {
  KnowledgeConflictResolution,
  KnowledgeImportItem,
  KnowledgeImportItemStatus,
  KnowledgeImportJobStatus,
} from "@/types";

type Props = { workspace: KnowledgeImportWorkspaceController };

const duplicateLabels = {
  none: "无重复",
  exact_content: "正文完全重复",
  same_title: "标题相同",
  same_file_name: "文件名相同",
  possible_duplicate: "疑似重复",
} as const;

const jobStatusLabels: Record<KnowledgeImportJobStatus, string> = {
  pending: "等待处理",
  preview_ready: "等待确认",
  processing: "正在导入",
  completed: "已完成",
  partial_failed: "部分失败",
  failed: "导入失败",
  cancelled: "已取消",
};

const itemStatusLabels: Record<KnowledgeImportItemStatus, string> = {
  preview_ready: "等待确认",
  ready: "等待处理",
  processing: "正在处理",
  completed: "已导入",
  failed: "失败",
  skipped: "已跳过",
  conflicted: "待处理冲突",
  cancelled: "已取消",
};

const chunkQualityLabels = {
  excellent: "优秀",
  usable: "可用",
  needs_attention: "需处理",
} as const;

function statusTone(status: KnowledgeImportJobStatus | KnowledgeImportItemStatus) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "failed" || status === "partial_failed") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "processing" || status === "pending" || status === "ready") return "bg-brand-50 text-brand-700 ring-brand-100";
  if (status === "conflicted") return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-slate-100 text-ink-600 ring-slate-200";
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function tagsValue(item: KnowledgeImportItem) {
  return item.metadata.tags.join("、");
}

function questionsValue(item: KnowledgeImportItem) {
  return item.metadata.suggestedQuestions.join("\n");
}

function parseTags(value: string) {
  return value.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function parseQuestions(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
}

function ChunkPreviewNavigator({ item }: { item: KnowledgeImportItem }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIndex = Math.max(0, item.chunkPreview.length - 1);
  const boundedIndex = Math.min(activeIndex, lastIndex);
  const chunk = item.chunkPreview[boundedIndex];

  return (
    <details className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-ink-600">
      <summary className="min-h-9 cursor-pointer font-semibold text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">查看分块预览（{item.chunkPreview.length}）</summary>
      {chunk ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2" aria-label={`${item.originalFileName} 分块预览导航`}>
            <p className="app-tabular font-medium text-ink-600">第 {boundedIndex + 1}/{item.chunkPreview.length} 个分块</p>
            <div className="flex gap-2">
              <button type="button" aria-label={`${item.originalFileName} 上一个分块`} disabled={boundedIndex === 0} onClick={() => setActiveIndex((current) => Math.max(0, current - 1))} className="app-button-tertiary min-h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50">上一个</button>
              <button type="button" aria-label={`${item.originalFileName} 下一个分块`} disabled={boundedIndex === lastIndex} onClick={() => setActiveIndex((current) => Math.min(lastIndex, current + 1))} className="app-button-tertiary min-h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50">下一个</button>
            </div>
          </div>
          <div data-testid={`knowledge-import-chunk-${item.id}-${chunk.chunkIndex}`} className="rounded border border-slate-200 bg-white p-3">
            <p className="font-semibold">Chunk #{chunk.chunkIndex} · {chunk.characterCount} 字 · 约 {chunk.approximateTokens} tokens · {chunkQualityLabels[chunk.qualityLevel]}</p>
            <p className="mt-1 break-words leading-5 text-ink-600">{chunk.contentPreview}</p>
            <p className="mt-1 break-words text-ink-500">关键词：{chunk.keywords.join("、") || "无"}</p>
          </div>
        </div>
      ) : <p className="mt-3 text-ink-500">当前文件没有可展示的分块预览。</p>}
    </details>
  );
}

export function KnowledgeBatchImportPanel({ workspace }: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const {
    storageStatus, packs, activeJob, files, knowledgePackId, busy, error, notice,
    setKnowledgePackId, chooseFiles, removeFile, preview, refresh, updateItemMetadata,
    updateConflictResolution, confirmAndProcess, retryFailed, cancel,
  } = workspace;

  if (!storageStatus) {
    return (
      <section data-testid="knowledge-batch-import" data-status="loading" aria-busy="true" className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-ink-900">企业知识批量导入</h3>
        <p role="status" className="mt-2 text-sm leading-6 text-ink-500">正在检查服务端存储与导入任务状态…</p>
      </section>
    );
  }

  if (storageStatus.storageMode !== "server") {
    const degraded = storageStatus?.storageMode === "degraded";
    return (
      <section data-testid="knowledge-batch-import" data-status={storageStatus.storageMode} className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-ink-900">企业知识批量导入</h3>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          {degraded ? "服务端暂不可用，不能启动或推进导入任务；恢复后可继续。" : "批量导入需要服务端存储。当前仍可使用下方的单文档本地导入。"}
        </p>
      </section>
    );
  }

  function selectFiles(input: HTMLInputElement) {
    if (input.files) chooseFiles(Array.from(input.files));
    input.value = "";
  }

  const canConfirm = activeJob?.status === "preview_ready";
  const canCancel = activeJob && !["completed", "cancelled"].includes(activeJob.status);
  const canRetry = Boolean(
    (activeJob?.status === "partial_failed" || activeJob?.status === "failed")
    && activeJob.items.some((item) => item.status === "failed" && item.retryable),
  );
  const processedItems = activeJob
    ? Math.min(activeJob.totalItems, activeJob.completedItems + activeJob.skippedItems + activeJob.failedItems)
    : 0;
  const progressValue = activeJob?.totalItems ? Math.round((processedItems / activeJob.totalItems) * 100) : 0;

  return (
    <section data-testid="knowledge-batch-import" data-status={activeJob?.status ?? "idle"} aria-busy={busy} className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink-900">企业知识批量导入</h3>
          <p className="mt-1 text-sm leading-6 text-ink-500">一次最多 10 个 TXT、Markdown、PDF 或 DOCX 文件。先预览和处理冲突，确认后才写入正式文档与 chunks；不保存原始上传文件。</p>
        </div>
        <button type="button" aria-label="刷新企业知识导入任务" disabled={busy} onClick={() => void refresh()} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-ink-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50">刷新任务</button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-4 text-sm text-ink-700 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <label htmlFor="knowledge-import-files" className="font-semibold">选择多个文件</label>
          <input
            id="knowledge-import-files"
            ref={fileInput}
            data-testid="knowledge-import-files"
            aria-label="选择企业知识导入文件"
            aria-describedby="knowledge-import-file-limits"
            type="file"
            multiple
            accept={SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS.join(",")}
            disabled={busy}
            onChange={(event) => selectFiles(event.currentTarget)}
            className="mt-3 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
          />
          <span id="knowledge-import-file-limits" className="mt-2 block text-xs text-ink-500">单文件最大 5MB，单批总大小最大 25MB；扫描型 PDF 不支持 OCR。</span>
          {files.length ? (
            <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-xs" aria-label={`已选择 ${files.length} 个文件`}>
              {files.map((file, index) => <li key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center gap-3"><span className="min-w-0 flex-1 truncate font-medium text-ink-700" title={file.name}>{file.name}</span><span className="shrink-0 tabular-nums text-ink-500">{formatBytes(file.size)}</span><button type="button" aria-label={`移除 ${file.name}`} disabled={busy} onClick={() => removeFile(index)} className="shrink-0 rounded px-2 py-1 font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50">移除</button></li>)}
            </ul>
          ) : null}
        </div>
        <div className="text-sm text-ink-700">
          <label htmlFor="knowledge-import-pack" className="font-semibold">所属企业知识包（可选）</label>
          <select id="knowledge-import-pack" data-testid="knowledge-import-pack" aria-label="批量导入所属企业知识包" value={knowledgePackId} onChange={(event) => setKnowledgePackId(event.target.value)} disabled={busy} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            <option value="">暂不归入知识包</option>
            {packs.filter((pack) => pack.status === "active").map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
          </select>
          <button data-testid="knowledge-import-preview" type="button" disabled={busy || !files.length} onClick={() => void preview()} className="mt-3 w-full rounded-md bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400">{busy ? "正在处理…" : "生成导入预览"}</button>
        </div>
      </div>

      {error ? <p role="alert" data-testid="knowledge-import-error" className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p aria-live="polite" data-testid="knowledge-import-notice" className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-brand-700">{notice}</p> : null}

      {activeJob ? (
        <div className="mt-5 space-y-4">
          <div className="border-y border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-ink-600">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" aria-live="polite">任务状态：<strong className="text-ink-900">{jobStatusLabels[activeJob.status]}</strong></p>
              <p className="tabular-nums text-ink-500">已处理 {processedItems}/{activeJob.totalItems} · {progressValue}%</p>
            </div>
            <progress aria-label="企业知识导入进度" value={processedItems} max={Math.max(1, activeJob.totalItems)} className="mt-3 h-2 w-full accent-brand-600" />
            <div className="mt-3 grid grid-cols-2 gap-2 tabular-nums sm:grid-cols-5">
              <p>成功：<strong className="text-emerald-700">{activeJob.completedItems}</strong></p><p>跳过：<strong>{activeJob.skippedItems}</strong></p><p>冲突：<strong className="text-amber-700">{activeJob.conflictedItems}</strong></p><p>失败：<strong className="text-rose-700">{activeJob.failedItems}</strong></p><p>总数：<strong>{activeJob.totalItems}</strong></p>
            </div>
          </div>

          <div className="space-y-3">
            {activeJob.items.map((item) => (
              <article key={item.id} data-testid={`knowledge-import-item-${item.id}`} data-status={item.status} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h4 className="break-all font-semibold text-ink-900">{item.originalFileName}</h4><p className="mt-1 text-xs text-ink-500">{item.mimeType} · {formatBytes(item.sizeBytes)} · 提取 {item.extractedCharacterCount} 字 · 预计 {item.estimatedChunkCount} chunks · checksum 已计算</p></div>
                  <div className="flex flex-wrap gap-2 text-xs"><span className="rounded bg-slate-100 px-2 py-1 text-ink-600 ring-1 ring-slate-200">{duplicateLabels[item.duplicateType]}</span><span className="rounded bg-brand-50 px-2 py-1 text-brand-700 ring-1 ring-brand-100">{item.qualityLabel}</span><span className={`rounded px-2 py-1 font-semibold ring-1 ${statusTone(item.status)}`}>{itemStatusLabels[item.status]}</span></div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-medium text-ink-700">标题<input aria-label={`${item.originalFileName} 导入标题`} value={item.metadata.title} maxLength={160} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { title: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-medium text-ink-700">分类<input aria-label={`${item.originalFileName} 文档分类`} value={item.metadata.category} maxLength={80} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { category: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-medium text-ink-700">标签<input aria-label={`${item.originalFileName} 文档标签`} value={tagsValue(item)} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { tags: parseTags(event.target.value) })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-medium text-ink-700">冲突处理<select aria-label={`${item.originalFileName} 冲突处理`} value={item.conflictResolution ?? (item.duplicateType === "none" ? "import_as_new" : "skip")} disabled={!canConfirm || busy} onChange={(event) => updateConflictResolution(item.id, event.target.value as KnowledgeConflictResolution)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"><option value="skip">跳过</option><option value="replace" disabled={!item.conflictDocumentId}>替换现有文档</option><option value="import_as_new">作为新文档导入</option></select></label>
                  <label className="text-xs font-medium text-ink-700">来源类型<select aria-label={`${item.originalFileName} 来源类型`} value={item.metadata.sourceType} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { sourceType: event.target.value as "user_upload" | "user_paste" })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"><option value="user_upload">文件上传</option><option value="user_paste">人工录入</option></select></label>
                  <label className="text-xs font-medium text-ink-700">所属知识包<select aria-label={`${item.originalFileName} 所属知识包`} value={item.metadata.knowledgePackId ?? ""} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { knowledgePackId: event.target.value || null })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">暂不归入知识包</option>{packs.filter((pack) => pack.status === "active").map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></label>
                  <label className="text-xs font-medium text-ink-700 md:col-span-2">建议问题<textarea aria-label={`${item.originalFileName} 建议问题`} value={questionsValue(item)} rows={2} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { suggestedQuestions: parseQuestions(event.target.value) })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                  <label className="flex items-center gap-2 text-xs font-medium text-ink-700"><input type="checkbox" checked={item.metadata.enabled} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { enabled: event.target.checked })} />导入后启用 RAG</label>
                </div>

                {item.warnings.length ? <ul className="mt-3 rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-800">{item.warnings.map((warning) => <li key={warning}>· {warning}</li>)}</ul> : null}
                {item.errorMessageSafe ? <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">{item.errorMessageSafe}{item.retryable ? ` 可重试${item.retryCount ? `（已重试 ${item.retryCount} 次）` : ""}。` : ""}</p> : null}
                <ChunkPreviewNavigator item={item} />
              </article>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {canConfirm ? <button data-testid="knowledge-import-confirm" type="button" disabled={busy} onClick={() => void confirmAndProcess()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:bg-slate-400">确认并开始导入</button> : null}
            {canRetry ? <button data-testid="knowledge-import-retry" type="button" disabled={busy} onClick={() => void retryFailed()} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:bg-slate-400">重试失败项</button> : null}
            {canCancel ? <button data-testid="knowledge-import-cancel" type="button" disabled={busy} onClick={() => void cancel()} className="rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-50">取消任务</button> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
