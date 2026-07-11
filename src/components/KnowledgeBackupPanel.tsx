"use client";

import { useState } from "react";
import {
  applyKnowledgeBackup,
  createKnowledgeBackup,
  previewKnowledgeBackup,
  type KnowledgeBackupPreview,
} from "@/lib/knowledge/storage";
import type { ImportedKnowledgeDocument } from "@/types";

type Props = {
  documents: ImportedKnowledgeDocument[];
  onDocumentsChange: (documents: ImportedKnowledgeDocument[]) => void;
};

export function KnowledgeBackupPanel({ documents, onDocumentsChange }: Props) {
  const [rawBackup, setRawBackup] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [preview, setPreview] = useState<KnowledgeBackupPreview | null>(null);
  const [notice, setNotice] = useState("");

  function downloadBackup() {
    const content = JSON.stringify(createKnowledgeBackup(documents), null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `enterprise-agent-hub-knowledge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("知识库备份已导出，仅包含用户文档及其检索元数据。");
  }

  function refreshPreview(nextRaw = rawBackup, nextMode = mode) {
    if (!nextRaw.trim()) {
      setPreview(null);
      return;
    }
    setPreview(previewKnowledgeBackup(nextRaw, documents, nextMode));
  }

  async function handleFile(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setNotice("备份文件过大，最大支持 2MB。请拆分后再恢复。");
      return;
    }
    try {
      const raw = await file.text();
      setRawBackup(raw);
      setFileName(file.name);
      setPreview(previewKnowledgeBackup(raw, documents, mode));
      setNotice("已读取备份文件，请确认预览和恢复模式。");
    } catch {
      setNotice("备份文件读取失败。");
    }
  }

  function applyRestore() {
    if (!preview?.ok) {
      setNotice(preview?.errors.join(" ") || "请先选择有效备份文件。");
      return;
    }
    if (mode === "replace" && !window.confirm("替换会移除当前所有用户文档，默认知识库不会受影响。确认继续吗？")) return;
    const saved = applyKnowledgeBackup(documents, preview, mode);
    if (!saved.ok) {
      setNotice(saved.error);
      return;
    }
    onDocumentsChange(saved.data);
    setNotice(mode === "replace" ? `已替换恢复 ${saved.data.length} 篇用户文档。` : `已合并恢复 ${preview.counts.new} 篇新用户文档。`);
    setRawBackup("");
    setFileName("");
    setPreview(null);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-ink-900">知识库备份与恢复</h3>
          <p className="mt-1 text-sm leading-6 text-ink-500">备份仅包含当前浏览器中的用户文档、启用状态、标签与建议测试问题；不会包含聊天记录、反馈、运维数据或模型配置。</p>
        </div>
        <button type="button" onClick={downloadBackup} className="shrink-0 rounded-md border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50">导出知识库</button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <label className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-ink-600 hover:border-brand-300">
          <span className="block font-semibold text-ink-800">导入 JSON 备份</span>
          <span className="mt-1 block text-xs text-ink-500">支持 V2 格式，单个备份文件最大 2MB。</span>
          <input type="file" accept="application/json,.json" className="mt-3 block w-full text-xs" onChange={(event) => void handleFile(event.target.files?.[0])} />
          {fileName ? <span className="mt-2 block break-words text-xs text-brand-700">已选择：{fileName}</span> : null}
        </label>
        <label className="text-sm text-ink-700">
          <span className="mb-2 block font-semibold">恢复模式</span>
          <select
            value={mode}
            onChange={(event) => {
              const nextMode = event.target.value as "merge" | "replace";
              setMode(nextMode);
              refreshPreview(rawBackup, nextMode);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="merge">合并：保留当前文档</option>
            <option value="replace">替换：仅保留备份文档</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-ink-500">重复和冲突记录会在恢复前预览；替换操作仍需二次确认。</p>
        </label>
      </div>

      {preview ? (
        <div className={preview.ok ? "mt-4 rounded-md bg-slate-50 p-3 text-sm text-ink-700" : "mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800"}>
          <p className="font-semibold">预览：共 {preview.counts.incoming} 篇，新增 {preview.counts.new} 篇，重复 {preview.counts.duplicate} 篇，冲突 {preview.counts.conflict} 篇，非法 {preview.counts.invalid} 篇。</p>
          {preview.errors.map((error) => <p key={error} className="mt-1 break-words">{error}</p>)}
          {preview.ok ? <button type="button" onClick={applyRestore} className={mode === "replace" ? "mt-3 rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700" : "mt-3 rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"}>{mode === "replace" ? "确认替换恢复" : "确认合并恢复"}</button> : null}
        </div>
      ) : null}
      {notice ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-ink-600">{notice}</p> : null}
    </section>
  );
}
