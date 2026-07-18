"use client";

import { useRef } from "react";
import type { KnowledgeImportWorkspaceController } from "@/components/knowledge-workspace/useKnowledgeImportWorkspace";
import { SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS } from "@/lib/knowledge/import-limits";
import type { KnowledgeConflictResolution, KnowledgeImportItem } from "@/types";

type Props = { workspace: KnowledgeImportWorkspaceController };

const duplicateLabels = {
  none: "无重复",
  exact_content: "正文完全重复",
  same_title: "标题相同",
  same_file_name: "文件名相同",
  possible_duplicate: "疑似重复",
} as const;

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

export function KnowledgeBatchImportPanel({ workspace }: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const {
    storageStatus, packs, activeJob, files, knowledgePackId, busy, error, notice,
    setKnowledgePackId, chooseFiles, preview, refresh, updateItemMetadata,
    updateConflictResolution, confirmAndProcess, retryFailed, cancel,
  } = workspace;

  if (!storageStatus || storageStatus.storageMode !== "server") {
    const degraded = storageStatus?.storageMode === "degraded";
    return (
      <section data-testid="knowledge-batch-import" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-ink-900">企业知识批量导入</h3>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          {degraded ? "服务端暂不可用，不能启动或推进导入任务；恢复后可继续。" : "批量导入需要服务端存储。当前仍可使用下方的单文档本地导入。"}
        </p>
      </section>
    );
  }

  function selectFiles(input: FileList | null) {
    if (!input) return;
    chooseFiles(Array.from(input));
  }

  const canConfirm = activeJob?.status === "preview_ready";
  const canCancel = activeJob && !["completed", "cancelled"].includes(activeJob.status);
  const canRetry = Boolean(
    (activeJob?.status === "partial_failed" || activeJob?.status === "failed")
    && activeJob.items.some((item) => item.status === "failed" && item.retryable),
  );

  return (
    <section data-testid="knowledge-batch-import" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink-900">企业知识批量导入</h3>
          <p className="mt-1 text-sm leading-6 text-ink-500">一次最多 10 个 TXT、Markdown、PDF 或 DOCX 文件。先预览和处理冲突，确认后才写入正式文档与 chunks；不保存原始上传文件。</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void refresh()} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-ink-600 disabled:opacity-50">刷新任务</button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
        <label className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-ink-700 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <span className="font-semibold">选择多个文件</span>
          <input
            ref={fileInput}
            data-testid="knowledge-import-files"
            type="file"
            multiple
            accept={SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS.join(",")}
            disabled={busy}
            onChange={(event) => selectFiles(event.target.files)}
            className="mt-3 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
          />
          <span className="mt-2 block text-xs text-ink-500">单文件最大 5MB，单批总大小最大 25MB；扫描型 PDF 不支持 OCR。</span>
          {files.length ? <span className="mt-2 block break-words text-xs text-brand-700">已选择：{files.map((file) => file.name).join("、")}</span> : null}
        </label>
        <label className="text-sm text-ink-700">
          <span className="font-semibold">所属企业知识包（可选）</span>
          <select data-testid="knowledge-import-pack" value={knowledgePackId} onChange={(event) => setKnowledgePackId(event.target.value)} disabled={busy} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            <option value="">暂不归入知识包</option>
            {packs.filter((pack) => pack.status === "active").map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
          </select>
          <button data-testid="knowledge-import-preview" type="button" disabled={busy || !files.length} onClick={() => void preview()} className="mt-3 w-full rounded-md bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400">{busy ? "正在处理…" : "生成导入预览"}</button>
        </label>
      </div>

      {error ? <p role="alert" data-testid="knowledge-import-error" className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p aria-live="polite" data-testid="knowledge-import-notice" className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-brand-700">{notice}</p> : null}

      {activeJob ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-2 rounded-lg bg-slate-50 p-4 text-sm text-ink-600 sm:grid-cols-3 lg:grid-cols-6">
            <p>状态：<strong className="text-ink-900">{activeJob.status}</strong></p>
            <p>总数：{activeJob.totalItems}</p><p>成功：{activeJob.completedItems}</p><p>跳过：{activeJob.skippedItems}</p><p>冲突：{activeJob.conflictedItems}</p><p>失败：{activeJob.failedItems}</p>
          </div>

          <div className="space-y-3">
            {activeJob.items.map((item) => (
              <article key={item.id} data-testid={`knowledge-import-item-${item.id}`} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h4 className="break-all font-semibold text-ink-900">{item.originalFileName}</h4><p className="mt-1 text-xs text-ink-500">{item.mimeType} · {formatBytes(item.sizeBytes)} · 提取 {item.extractedCharacterCount} 字 · 预计 {item.estimatedChunkCount} chunks · checksum 已计算</p></div>
                  <div className="flex flex-wrap gap-2 text-xs"><span className="rounded bg-slate-100 px-2 py-1 text-ink-600">{duplicateLabels[item.duplicateType]}</span><span className="rounded bg-brand-50 px-2 py-1 text-brand-700">{item.qualityLabel}</span><span className="rounded bg-slate-100 px-2 py-1 text-ink-600">{item.status}</span></div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-medium text-ink-700">标题<input value={item.metadata.title} maxLength={160} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { title: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-medium text-ink-700">分类<input value={item.metadata.category} maxLength={80} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { category: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-medium text-ink-700">标签<input value={tagsValue(item)} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { tags: parseTags(event.target.value) })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-medium text-ink-700">冲突处理<select aria-label="冲突处理" value={item.conflictResolution ?? (item.duplicateType === "none" ? "import_as_new" : "skip")} disabled={!canConfirm || busy} onChange={(event) => updateConflictResolution(item.id, event.target.value as KnowledgeConflictResolution)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"><option value="skip">跳过</option><option value="replace" disabled={!item.conflictDocumentId}>替换现有文档</option><option value="import_as_new">作为新文档导入</option></select></label>
                  <label className="text-xs font-medium text-ink-700">来源类型<select aria-label="来源类型" value={item.metadata.sourceType} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { sourceType: event.target.value as "user_upload" | "user_paste" })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"><option value="user_upload">文件上传</option><option value="user_paste">人工录入</option></select></label>
                  <label className="text-xs font-medium text-ink-700">所属知识包<select aria-label="所属知识包" value={item.metadata.knowledgePackId ?? ""} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { knowledgePackId: event.target.value || null })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">暂不归入知识包</option>{packs.filter((pack) => pack.status === "active").map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></label>
                  <label className="text-xs font-medium text-ink-700 md:col-span-2">建议问题<textarea value={questionsValue(item)} rows={2} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { suggestedQuestions: parseQuestions(event.target.value) })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                  <label className="flex items-center gap-2 text-xs font-medium text-ink-700"><input type="checkbox" checked={item.metadata.enabled} disabled={!canConfirm || busy} onChange={(event) => updateItemMetadata(item.id, { enabled: event.target.checked })} />导入后启用 RAG</label>
                </div>

                {item.warnings.length ? <ul className="mt-3 rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-800">{item.warnings.map((warning) => <li key={warning}>· {warning}</li>)}</ul> : null}
                <details className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-ink-600">
                  <summary className="cursor-pointer font-semibold text-ink-800">查看分块预览（{item.chunkPreview.length}）</summary>
                  <div className="mt-3 space-y-2">{item.chunkPreview.map((chunk) => <div key={chunk.chunkIndex} className="rounded border border-slate-200 bg-white p-3"><p className="font-semibold">Chunk #{chunk.chunkIndex} · {chunk.characterCount} 字 · 约 {chunk.approximateTokens} tokens · {chunk.qualityLevel}</p><p className="mt-1 break-words leading-5 text-ink-500">{chunk.contentPreview}</p><p className="mt-1 break-words text-ink-400">关键词：{chunk.keywords.join("、") || "无"}</p></div>)}</div>
                </details>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {canConfirm ? <button data-testid="knowledge-import-confirm" type="button" disabled={busy} onClick={() => void confirmAndProcess()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">确认并开始导入</button> : null}
            {canRetry ? <button data-testid="knowledge-import-retry" type="button" disabled={busy} onClick={() => void retryFailed()} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">重试失败项</button> : null}
            {canCancel ? <button data-testid="knowledge-import-cancel" type="button" disabled={busy} onClick={() => void cancel()} className="rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">取消任务</button> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
