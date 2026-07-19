"use client";

import { useRef, useState } from "react";
import { knowledgePacks } from "@/data/knowledgePacks";
import { createImportedKnowledgeDocument, readKnowledgeFile, SUPPORTED_IMPORT_EXTENSIONS, titleFromMarkdown } from "@/lib/knowledge/import";
import { findDuplicateKnowledgeDocuments } from "@/lib/knowledge/quality";
import type { ImportedKnowledgeDocument, KnowledgeDocument, KnowledgeSourceType } from "@/types";

type DocumentFormProps = {
  onAdd: (document: ImportedKnowledgeDocument) => boolean | Promise<boolean>;
  existingDocuments: KnowledgeDocument[];
  disabled?: boolean;
  disabledReason?: string;
};

const categories = ["制度流程", "售后规则", "岗位说明", "AI 工程规范", "用户导入", "General"];

function parseTags(value: string) {
  return value
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

export function DocumentForm({ onAdd, existingDocuments, disabled = false, disabledReason }: DocumentFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [packId, setPackId] = useState<string>(knowledgePacks[0]?.id ?? "enterprise-policy");
  const [category, setCategory] = useState(categories[0]);
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState("");
  const [sourceType, setSourceType] = useState<Extract<KnowledgeSourceType, "user_upload" | "user_paste">>("user_paste");
  const [enabled, setEnabled] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsImporting(true);
    setError("");
    setSuccess("");

    try {
      let parsedContent = content.trim();
      let resolvedSourceType = sourceType;
      let originalFileName: string | undefined;
      let resolvedTitle = title.trim();

      if (file) {
        const parsed = await readKnowledgeFile(file);
        if (!parsed.ok) {
          setError(parsed.error.message);
          return;
        }
        parsedContent = parsed.content;
        resolvedSourceType = "user_upload";
        originalFileName = file.name;
        resolvedTitle = resolvedTitle || titleFromMarkdown(parsedContent) || titleFromFileName(file.name);
      }

      const result = createImportedKnowledgeDocument({
        title: resolvedTitle,
        category,
        tags: parseTags(tags),
        packId,
        content: parsedContent,
        sourceType: resolvedSourceType,
        originalFileName,
        suggestedQuestions: suggestedQuestions.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        enabled,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const duplicates = findDuplicateKnowledgeDocuments(result.document, existingDocuments);
      const saved = await onAdd(result.document);
      if (!saved) {
        setError("文档未保存，请检查存储状态后重试。");
        return;
      }
      setSuccess(
        duplicates.length
          ? `已成功导入：${result.document.title}。检测到可能重复内容：${duplicates.map((item) => `${item.title}（${item.similarity}%）`).join("、")}，建议核对后决定是否保留。`
          : `已成功导入：${result.document.title}`,
      );
      setTitle("");
      setPackId(knowledgePacks[0]?.id ?? "enterprise-policy");
      setCategory(categories[0]);
      setTags("");
      setContent("");
      setSuggestedQuestions("");
      setSourceType("user_paste");
      setEnabled(true);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isImporting} className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-ink-900">导入知识文档</h2>
        <p className="mt-1 text-sm leading-6 text-ink-500">
          支持粘贴文本或选择本地 txt / md / json / csv 文件。文档会按当前存储模式保存到浏览器或服务端工作区；发起聊天时，启用文档参与检索，Real 模式下仅相关命中片段可能发送给配置的模型服务。
        </p>
      </div>
      {disabled && disabledReason ? <p id="knowledge-document-disabled-reason" role="status" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{disabledReason}</p> : null}
      <fieldset disabled={disabled || isImporting} aria-describedby={disabled && disabledReason ? "knowledge-document-disabled-reason" : undefined} className="space-y-4 disabled:opacity-70">
        <legend className="sr-only">知识文档内容</legend>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">标题</span>
          <input data-testid="knowledge-document-title" aria-label="知识文档标题" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="例如：公司笔记本电脑申请制度" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">来源类型</span>
          <select
            aria-label="知识文档来源类型"
            value={sourceType}
            onChange={(event) => {
              const nextType = event.target.value as Extract<KnowledgeSourceType, "user_upload" | "user_paste">;
              setSourceType(nextType);
              if (nextType === "user_paste") {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="user_paste">用户粘贴</option>
            <option value="user_upload">本地文件</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">知识库包</span>
            <select aria-label="知识文档所属知识库包" value={packId} onChange={(event) => setPackId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              {knowledgePacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-700">分类</span>
            <select aria-label="知识文档分类" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">标签</span>
          <input aria-label="知识文档标签" value={tags} onChange={(event) => setTags(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="例如：电脑申请、资产、审批；留空时会自动提取" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">粘贴文本导入</span>
          <textarea data-testid="knowledge-document-content" aria-label="知识文档正文" value={content} onChange={(event) => setContent(event.target.value)} rows={6} disabled={sourceType === "user_upload"} className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-ink-400" placeholder="粘贴制度、SOP、FAQ 或业务说明。" />
        </label>
        <label className={"block rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 " + (sourceType === "user_paste" ? "opacity-60" : "")}>
          <span className="text-sm font-medium text-ink-700">选择本地文件</span>
          <input ref={fileInputRef} aria-label="选择知识文档文件" aria-describedby="knowledge-document-file-limits" type="file" disabled={sourceType === "user_paste"} accept={SUPPORTED_IMPORT_EXTENSIONS.join(",")} onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            if (selected) setSourceType("user_upload");
            if (selected && !title.trim()) setTitle(titleFromFileName(selected.name));
          }} className="mt-2 block w-full text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100 disabled:cursor-not-allowed" />
          <p id="knowledge-document-file-limits" className="mt-2 text-xs text-ink-500">支持 .txt / .md / .json / .csv，单文件不超过 1MB。</p>
          {file ? <p className="mt-1 break-all text-xs text-ink-600">已选择：{file.name}</p> : null}
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">建议测试问题</span>
          <textarea
            aria-label="知识文档建议测试问题"
            value={suggestedQuestions}
            onChange={(event) => setSuggestedQuestions(event.target.value)}
            rows={3}
            className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder={"每行一个问题，例如：\n公司笔记本电脑申请适用于哪些人？\n申请审批通常需要多久？"}
          />
          <p className="mt-1 text-xs text-ink-500">最多保存 5 个，用于一键跳转聊天工作台验证 RAG。</p>
        </label>
        <label className="flex items-start gap-3 rounded-md bg-slate-50 p-3">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          <span>
            <span className="block text-sm font-medium text-ink-700">保存后启用参与 RAG</span>
            <span className="mt-1 block text-xs leading-5 text-ink-500">关闭后文档仍会按当前存储模式保存，但聊天工作台不会检索它。</span>
          </span>
        </label>
        {error ? <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
        {success ? <p role="status" aria-live="polite" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
        <button data-testid="knowledge-document-submit" type="submit" disabled={isImporting || disabled} className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400">
          {isImporting ? "导入中..." : "导入到知识库"}
        </button>
      </fieldset>
    </form>
  );
}
