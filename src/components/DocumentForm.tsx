"use client";

import { useRef, useState } from "react";
import { knowledgePacks } from "@/data/knowledgePacks";
import { createImportedKnowledgeDocument, readKnowledgeFile, SUPPORTED_IMPORT_EXTENSIONS, titleFromMarkdown } from "@/lib/knowledge/import";
import type { ImportedKnowledgeDocument, KnowledgeSourceType } from "@/types";

type DocumentFormProps = {
  onAdd: (document: ImportedKnowledgeDocument) => void;
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

export function DocumentForm({ onAdd }: DocumentFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [packId, setPackId] = useState<string>(knowledgePacks[0]?.id ?? "enterprise-policy");
  const [category, setCategory] = useState(categories[0]);
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
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
      let sourceType: Extract<KnowledgeSourceType, "user_upload" | "user_paste"> = "user_paste";
      let originalFileName: string | undefined;
      let resolvedTitle = title.trim();

      if (file) {
        const parsed = await readKnowledgeFile(file);
        if (!parsed.ok) {
          setError(parsed.error.message);
          return;
        }
        parsedContent = parsed.content;
        sourceType = "user_upload";
        originalFileName = file.name;
        resolvedTitle = resolvedTitle || titleFromMarkdown(parsedContent) || titleFromFileName(file.name);
      }

      const result = createImportedKnowledgeDocument({
        title: resolvedTitle,
        category,
        tags: parseTags(tags),
        packId,
        content: parsedContent,
        sourceType,
        originalFileName,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      onAdd(result.document);
      setSuccess(`已成功导入：${result.document.title}`);
      setTitle("");
      setPackId(knowledgePacks[0]?.id ?? "enterprise-policy");
      setCategory(categories[0]);
      setTags("");
      setContent("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold text-ink-900">导入知识文档</h2>
        <p className="mt-1 text-sm leading-6 text-ink-500">
          支持粘贴文本或选择本地 txt / md / json / csv 文件，内容仅保存在当前浏览器 localStorage，不上传服务器。
        </p>
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="例如：公司笔记本电脑申请制度" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">知识库包</span>
            <select value={packId} onChange={(event) => setPackId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              {knowledgePacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-700">分类</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">标签</span>
          <input value={tags} onChange={(event) => setTags(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="例如：电脑申请、资产、审批；留空时会自动提取" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">粘贴文本导入</span>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="粘贴制度、SOP、FAQ、岗位 JD 或业务说明。若同时选择文件，将优先导入文件内容。" />
        </label>
        <label className="block rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
          <span className="text-sm font-medium text-ink-700">选择本地文件</span>
          <input ref={fileInputRef} type="file" accept={SUPPORTED_IMPORT_EXTENSIONS.join(",")} onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            if (selected && !title.trim()) setTitle(titleFromFileName(selected.name));
          }} className="mt-2 block w-full text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100" />
          <p className="mt-2 text-xs text-ink-500">支持 .txt / .md / .json / .csv，单文件不超过 1MB。</p>
          {file ? <p className="mt-1 break-all text-xs text-ink-600">已选择：{file.name}</p> : null}
        </label>
        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
        <button type="submit" disabled={isImporting} className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400">
          {isImporting ? "导入中..." : "导入到知识库"}
        </button>
      </div>
    </form>
  );
}
