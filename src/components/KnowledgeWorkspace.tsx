"use client";

import { useEffect, useMemo, useState } from "react";
import { ChunkList } from "@/components/ChunkList";
import { DocumentForm } from "@/components/DocumentForm";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { documents as defaultDocuments } from "@/data/mock";
import { enterpriseKnowledgePacks } from "@/data/enterpriseKnowledgePacks";
import { knowledgePacks } from "@/data/knowledgePacks";
import { loadChatFeedback } from "@/lib/chat/feedback";
import { loadChatHistory } from "@/lib/chat/history";
import { assessKnowledgeDocument, findDuplicateKnowledgeDocuments } from "@/lib/knowledge/quality";
import { clearUserKnowledgeDocuments, readUserKnowledgeDocumentsWithStatus, writeUserKnowledgeDocuments } from "@/lib/knowledge/storage";
import { splitDocument } from "@/lib/rag";
import type { AgentApiResponse, ChatAnswerFeedbackItem, ChatRunHistoryItem, ImportedKnowledgeDocument, KnowledgeDocument, KnowledgeSourceType } from "@/types";

const allPackOption = "all";
const allCategoryOption = "all";
const allSourceOption = "all";

type SourceFilter = typeof allSourceOption | KnowledgeSourceType;

const ui = {
  defaultSource: "\u9ed8\u8ba4\u77e5\u8bc6\u5e93",
  userUpload: "\u7528\u6237\u4e0a\u4f20",
  userPaste: "\u7528\u6237\u7c98\u8d34",
  title: "\u771f\u5b9e\u77e5\u8bc6\u5e93\u7ba1\u7406",
  intro: "\u7cfb\u7edf\u5185\u7f6e\u9ed8\u8ba4 Knowledge Packs \u53ea\u8bfb\u53ef\u68c0\u7d22\uff0c\u7528\u6237\u4e0a\u4f20\u548c\u7c98\u8d34\u6587\u6863\u9ed8\u8ba4\u4fdd\u5b58\u5728\u6d4f\u89c8\u5668 localStorage\uff0c\u53d1\u8d77\u804a\u5929\u65f6\u542f\u7528\u6587\u6863\u4f1a\u53d1\u9001\u7ed9\u672c\u5e94\u7528\u670d\u52a1\u7aef\u53c2\u4e0e RAG\u3002",
  clearUserDocs: "\u6e05\u7a7a\u7528\u6237\u6587\u6863",
  defaultDocCount: "\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u6587\u6863",
  userDocCount: "\u7528\u6237\u5bfc\u5165\u6587\u6863",
  totalChunks: "\u603b chunks",
  enabledDocs: "启用文档",
  activeChunks: "参与检索 chunks",
  lastImportedAt: "最近导入",
  activeSources: "\u53c2\u4e0e\u68c0\u7d22\u6765\u6e90",
  docUnit: "\u7bc7",
  chunkUnit: "\u4e2a",
  allPacks: "\u5168\u90e8\u77e5\u8bc6\u5e93\u5305",
  allCategories: "\u5168\u90e8\u5206\u7c7b",
  allSources: "\u5168\u90e8\u6765\u6e90",
  searchPlaceholder: "\u641c\u7d22\u6807\u9898\u3001\u6458\u8981\u3001\u6807\u7b7e\u6216\u6b63\u6587\uff0c\u4f8b\u5982\uff1a\u7535\u8111\u7533\u8bf7\u3001VPN\u3001\u9000\u6b3e\u3001JSON\u3001\u5019\u9009\u4eba\u8bc4\u5206",
  builtinSection: "\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u5206\u7c7b",
  builtinDesc: "\u7cfb\u7edf\u5185\u7f6e / \u53ea\u8bfb\uff0c\u4e0d\u9700\u8981\u5bfc\u5165\uff0c\u542f\u52a8\u540e\u5929\u7136\u53c2\u4e0e RAG \u68c0\u7d22\u3002",
  readonly: "\u7cfb\u7edf\u5185\u7f6e / \u53ea\u8bfb",
  readonlyShort: "\u53ea\u8bfb",
  userImportTitle: "\u7528\u6237\u6587\u6863\u5bfc\u5165",
  userImportDesc: "\u652f\u6301\u7c98\u8d34\u6587\u672c\u548c\u672c\u5730 .txt / .md / .json / .csv \u6587\u4ef6\u5bfc\u5165\uff0c\u9ed8\u8ba4\u4fdd\u5b58\u5728\u5f53\u524d\u6d4f\u89c8\u5668 localStorage\uff1bReal \u6a21\u5f0f\u4e0b\u4ec5\u76f8\u5173\u547d\u4e2d\u7247\u6bb5\u53ef\u80fd\u53d1\u9001\u81f3\u914d\u7f6e\u7684\u6a21\u578b\u670d\u52a1\u3002",
  docList: "\u6587\u6863\u5217\u8868",
  currentFilterPrefix: "\u5f53\u524d\u7b5b\u9009 ",
  currentFilterSuffix: " \u7bc7\u3002\u9ed8\u8ba4\u6587\u6863\u4e0d\u53ef\u5220\u9664\uff0c\u7528\u6237\u6587\u6863\u53ef\u5220\u9664\u3002",
  noTags: "\u65e0\u6807\u7b7e",
  delete: "\u5220\u9664",
  enable: "启用检索",
  disable: "禁用检索",
  enabled: "参与检索",
  disabled: "已禁用",
  emptyDocs: "\u6ca1\u6709\u5339\u914d\u7684\u6587\u6863\u3002\u53ef\u4ee5\u8c03\u6574\u641c\u7d22\u6761\u4ef6\uff0c\u6216\u5bfc\u5165\u81ea\u5df1\u7684\u4e1a\u52a1\u6587\u6863\u3002",
  docDetail: "文档详情",
  noDocument: "\u672a\u9009\u62e9\u6587\u6863",
  category: "\u5206\u7c7b\uff1a",
  updatedAt: "\u66f4\u65b0\u65f6\u95f4\uff1a",
  chunks: "chunks\uff1a",
  source: "\u6765\u6e90\uff1a",
  tags: "\u6807\u7b7e\uff1a",
  none: "\u65e0",
  deleteThisDoc: "\u5220\u9664\u8be5\u7528\u6237\u6587\u6863",
  ragStatus: "RAG 状态：",
  suggestedQuestions: "建议测试问题",
  qualityDiagnosis: "知识库质量诊断",
  qualityGood: "当前文档质量良好，可直接参与 RAG 检索。",
  qualityIssues: "待优化项",
  testInChat: "测试这个问题",
  canAnswer: "可回答问题",
  ragIncluded: "参与 RAG",
  ragExcluded: "不参与 RAG",
  ragParticipation: "RAG 参与状态",
  qualityPreview: "质量提示",
  noQualityIssues: "暂无明显质量问题",
  documentSummary: "文档摘要",
  qualityOverview: "质量诊断概览",
  qualityOverviewDesc: "以下提示用于帮助补齐可检索内容，不会阻止文档参与 RAG。",
  docTooShort: "正文偏短，建议补充适用范围、流程、边界和例外情况。",
  fewChunks: "chunks 数偏少，检索覆盖面有限，建议补充更多业务细节。",
  missingTags: "标签不足，建议补充 3-8 个业务关键词，提升检索命中率。",
  missingSummary: "缺少摘要，建议补充一句话说明文档用途。",
  neverImported: "暂无用户导入",
  noUserDocs: "暂无用户文档",
  disabledNote: "该文档已禁用，不会参与 /chat 的 RAG 检索；你可以随时重新启用。",
  readonlyNote: "\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u4e3a\u7cfb\u7edf\u5185\u7f6e\u53ea\u8bfb\u8d44\u6599\uff0c\u4e0d\u652f\u6301\u5220\u9664\u3002",
  chunksTitle: "\u6587\u6863\u5207\u7247 chunks",
  chunksDesc: "\u5207\u7247\u4f1a\u53c2\u4e0e keyword RAG \u68c0\u7d22\uff0c\u5e76\u4fdd\u7559\u6765\u6e90\u7c7b\u578b\u3001\u5206\u7c7b\u3001\u6807\u7b7e\u548c\u5173\u952e\u8bcd\u3002",
  citationExample: "\u6765\u6e90\u5f15\u7528\u793a\u4f8b",
  confirmClear: "\u786e\u8ba4\u6e05\u7a7a\u6240\u6709\u7528\u6237\u5bfc\u5165\u6587\u6863\u5417\uff1f\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u4e0d\u4f1a\u88ab\u5220\u9664\u3002",
  imported: "\u5df2\u5bfc\u5165\u7528\u6237\u6587\u6863\uff1a",
  deleted: "\u5df2\u5220\u9664\u7528\u6237\u6587\u6863\uff1a",
  cleared: "\u5df2\u6e05\u7a7a\u7528\u6237\u6587\u6863\u3002\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u4fdd\u6301\u53ef\u7528\u3002",
};

function sourceTypeLabel(sourceType?: KnowledgeSourceType) {
  const labels: Record<KnowledgeSourceType, string> = {
    default: ui.defaultSource,
    user_upload: ui.userUpload,
    user_paste: ui.userPaste,
  };
  return sourceType ? labels[sourceType] ?? sourceType : ui.defaultSource;
}

function sourceBadgeClass(sourceType?: KnowledgeSourceType) {
  if (sourceType === "user_upload") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (sourceType === "user_paste") return "bg-amber-50 text-amber-700 ring-amber-100";
  return "bg-slate-100 text-ink-600 ring-slate-200";
}

function includesText(document: KnowledgeDocument, keyword: string) {
  if (!keyword.trim()) return true;
  const target = [document.title, document.category, document.summary, document.content, document.source, document.owner, ...(document.tags ?? [])].join(" ").toLowerCase();
  return target.includes(keyword.trim().toLowerCase());
}

function categoryIntro(packId: string) {
  const intros: Record<string, string> = {
    "enterprise-policy": "\u4f01\u4e1a\u5236\u5ea6\u3001IT \u884c\u653f\u3001\u6743\u9650\u3001\u5b89\u5168\u3001\u62a5\u9500\u3001\u8bf7\u5047\u7b49\u5185\u90e8\u77e5\u8bc6\u3002",
    "ecommerce-support": "\u552e\u540e\u653f\u7b56\u3001\u9000\u6b3e\u6362\u8d27\u3001\u7269\u6d41\u5f02\u5e38\u3001\u4f1a\u5458\u6743\u76ca\u4e0e\u6295\u8bc9\u5347\u7ea7\u89c4\u5219\u3002",
    "recruitment-career": "\u5c97\u4f4d JD\u3001\u5019\u9009\u4eba\u8bc4\u5206\u3001\u7b80\u5386\u7b5b\u9009\u3001\u9762\u8bd5\u6d41\u7a0b\u4e0e\u9879\u76ee\u5339\u914d\u89c4\u5219\u3002",
    "ai-engineering": "RAG\u3001Agent Router\u3001Tool Calling\u3001JSON \u8f93\u51fa\u3001fallback\u3001\u90e8\u7f72\u4e0e\u8bc4\u6d4b\u89c4\u8303\u3002",
  };
  return intros[packId] ?? "\u7cfb\u7edf\u5185\u7f6e\u4e1a\u52a1\u77e5\u8bc6\u3002";
}

function suggestedQuestions(document: KnowledgeDocument) {
  if (document.suggestedQuestions?.length) return document.suggestedQuestions;
  const tags = (document.tags ?? []).slice(0, 2).join("、");
  const subject = tags || document.title;
  return [
    `${subject} 的适用范围是什么？`,
    `${document.title} 里有哪些关键流程和注意事项？`,
    `根据 ${document.title}，我下一步应该准备什么材料？`,
  ];
}

function isDocumentEnabled(document: KnowledgeDocument) {
  return document.sourceType === "default" || document.enabled !== false;
}

function chatQuestionHref(question: string) {
  return `/chat?question=${encodeURIComponent(question)}`;
}

function documentQualityIssues(document: KnowledgeDocument) {
  return assessKnowledgeDocument(document).issues;
}

function qualityBadgeClass(level: ReturnType<typeof assessKnowledgeDocument>["level"]) {
  if (level === "excellent") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (level === "usable") return "bg-brand-50 text-brand-700 ring-brand-100";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

export function KnowledgeWorkspace() {
  const [userDocuments, setUserDocuments] = useState<ImportedKnowledgeDocument[]>([]);
  const [selectedPack, setSelectedPack] = useState(allPackOption);
  const [selectedCategory, setSelectedCategory] = useState(allCategoryOption);
  const [selectedSourceType, setSelectedSourceType] = useState<SourceFilter>(allSourceOption);
  const [search, setSearch] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState(defaultDocuments[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatRunHistoryItem[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<ChatAnswerFeedbackItem[]>([]);

  useEffect(() => {
    const loaded = readUserKnowledgeDocumentsWithStatus();
    setUserDocuments(loaded.data);
    if (!loaded.ok) setNotice(`用户文档读取失败：${loaded.error}`);

    const loadedHistory = loadChatHistory();
    setChatHistory(loadedHistory.data);
    const loadedFeedback = loadChatFeedback();
    setFeedbackItems(loadedFeedback.data);
  }, []);

  const allDocuments = useMemo<KnowledgeDocument[]>(() => [...defaultDocuments, ...userDocuments], [userDocuments]);
  const enabledDocuments = useMemo<KnowledgeDocument[]>(() => allDocuments.filter(isDocumentEnabled), [allDocuments]);
  const categories = useMemo(() => Array.from(new Set(allDocuments.map((document) => document.category).filter(Boolean))).sort(), [allDocuments]);
  const defaultChunkCount = useMemo(() => defaultDocuments.reduce((sum, document) => sum + splitDocument(document).length, 0), []);
  const userChunkCount = useMemo(() => userDocuments.reduce((sum, document) => sum + splitDocument(document).length, 0), [userDocuments]);
  const activeChunkCount = useMemo(() => enabledDocuments.reduce((sum, document) => sum + splitDocument(document).length, 0), [enabledDocuments]);
  const lastImportedAt = useMemo(() => {
    const sorted = userDocuments.map((document) => document.importedAt ?? document.createdAt).sort();
    return sorted[sorted.length - 1];
  }, [userDocuments]);
  const disabledUserCount = userDocuments.filter((document) => document.enabled === false).length;
  const activeSourceTypes = useMemo(() => Array.from(new Set(enabledDocuments.map((document) => document.sourceType ?? "default"))).map((sourceType) => sourceTypeLabel(sourceType as KnowledgeSourceType)), [enabledDocuments]);
  const usageDiagnostics = useMemo(() => {
    const sourceCounts = new Map<string, { title: string; count: number }>();
    chatHistory.forEach((item) => {
      const snapshot = item.resultSnapshot as AgentApiResponse | undefined;
      snapshot?.ragAnswer?.sources.forEach((source) => {
        const current = sourceCounts.get(source.documentId) ?? { title: source.title, count: 0 };
        sourceCounts.set(source.documentId, { title: current.title, count: current.count + 1 });
      });
    });
    const mostCited = Array.from(sourceCounts.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 3);
    const neverCited = enabledDocuments.filter((document) => !sourceCounts.has(document.id)).slice(0, 5);
    const fallbackCount = chatHistory.filter((item) => item.fallback).length;
    const noRecallCount = chatHistory.filter((item) => (item.sourcesCount ?? 0) === 0 || item.retrievalConfidence === "low").length
      + feedbackItems.filter((item) => item.retrievalConfidence === "low").length;
    return { mostCited, neverCited, fallbackCount, noRecallCount };
  }, [chatHistory, enabledDocuments, feedbackItems]);

  const filteredDocuments = allDocuments.filter((document) => {
    const packMatched = selectedPack === allPackOption || document.packId === selectedPack;
    const categoryMatched = selectedCategory === allCategoryOption || document.category === selectedCategory;
    const sourceMatched = selectedSourceType === allSourceOption || (document.sourceType ?? "default") === selectedSourceType;
    return packMatched && categoryMatched && sourceMatched && includesText(document, search);
  });

  const selectedDocument = allDocuments.find((document) => document.id === selectedDocumentId) ?? filteredDocuments[0] ?? allDocuments[0];
  const chunks = selectedDocument ? splitDocument(selectedDocument) : [];
  const isSelectedUserDocument = Boolean(selectedDocument && selectedDocument.sourceType !== "default");
  const selectedSuggestedQuestions = selectedDocument ? suggestedQuestions(selectedDocument) : [];
  const selectedQualityIssues = selectedDocument ? documentQualityIssues(selectedDocument) : [];
  const selectedQuality = selectedDocument ? assessKnowledgeDocument(selectedDocument) : null;
  const selectedDuplicateMatches = selectedDocument
    ? findDuplicateKnowledgeDocuments(selectedDocument, allDocuments.filter((document) => document.id !== selectedDocument.id))
    : [];
  const libraryQualityIssues = enabledDocuments
    .map((document) => ({ document, issues: documentQualityIssues(document) }))
    .filter((item) => item.issues.length > 0)
    .slice(0, 6);

  function handleAdd(document: ImportedKnowledgeDocument) {
    const duplicates = findDuplicateKnowledgeDocuments(document, allDocuments);
    const nextDocuments = [document, ...userDocuments.filter((item) => item.id !== document.id)];
    const saved = writeUserKnowledgeDocuments(nextDocuments);
    const persistedDocuments = saved.ok ? saved.data : nextDocuments;
    const chunkCount = splitDocument(document).length;
    setUserDocuments(persistedDocuments);
    setSelectedDocumentId(document.id);
    setSelectedPack(document.packId ?? allPackOption);
    setSelectedCategory(allCategoryOption);
    setSelectedSourceType(document.sourceType);
    setNotice(
      saved.ok
        ? `已成功导入：${document.title}。已保存到当前浏览器本地，刷新页面后仍会保留；已生成 ${chunkCount} 个 chunks，${document.enabled === false ? "当前未启用 RAG 检索" : "已加入 RAG 检索"}。${duplicates.length ? ` 检测到可能重复文档：${duplicates.map((item) => item.title).join("、")}。` : ""}`
        : `已导入到当前页面状态，但保存到 localStorage 失败：${saved.error}`,
    );
  }

  function handleDelete(documentId: string) {
    const target = userDocuments.find((document) => document.id === documentId);
    if (!target) return;
    const nextDocuments = userDocuments.filter((document) => document.id !== documentId);
    const saved = writeUserKnowledgeDocuments(nextDocuments);
    setUserDocuments(saved.ok ? saved.data : nextDocuments);
    setSelectedDocumentId(defaultDocuments[0]?.id ?? "");
    setNotice(saved.ok ? ui.deleted + target.title : `已从页面删除，但同步 localStorage 失败：${saved.error}`);
  }

  function handleToggleEnabled(documentId: string) {
    const target = userDocuments.find((document) => document.id === documentId);
    if (!target) return;
    const nextDocuments = userDocuments.map((document) => document.id === documentId ? { ...document, enabled: document.enabled === false } : document);
    const saved = writeUserKnowledgeDocuments(nextDocuments);
    setUserDocuments(saved.ok ? saved.data : nextDocuments);
    setNotice(saved.ok ? `${target.title} 已${target.enabled === false ? "启用" : "禁用"} RAG 检索。` : `状态已更新，但同步 localStorage 失败：${saved.error}`);
  }

  function handleClearUserDocuments() {
    if (!userDocuments.length) return;
    const confirmed = window.confirm(ui.confirmClear);
    if (!confirmed) return;
    const cleared = clearUserKnowledgeDocuments();
    setUserDocuments([]);
    setSelectedDocumentId(defaultDocuments[0]?.id ?? "");
    setSelectedSourceType(allSourceOption);
    setNotice(cleared.ok ? ui.cleared : `已清空页面状态，但同步 localStorage 失败：${cleared.error}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
      <section className="space-y-5 min-w-0">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Knowledge Library</p><h2 className="mt-1 font-semibold text-ink-900">{ui.title}</h2><p className="mt-1 text-sm leading-6 text-ink-500">{ui.intro}</p></div>
            <button type="button" onClick={handleClearUserDocuments} disabled={!userDocuments.length} className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-ink-400">{ui.clearUserDocs}</button>
          </div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-6"><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">{ui.defaultDocCount}</p><p className="mt-1 font-semibold text-ink-900">{defaultDocuments.length} {ui.docUnit}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">{ui.userDocCount}</p><p className="mt-1 font-semibold text-ink-900">{userDocuments.length} {ui.docUnit}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">{ui.enabledDocs}</p><p className="mt-1 font-semibold text-ink-900">{enabledDocuments.length} {ui.docUnit}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">{ui.totalChunks}</p><p className="mt-1 font-semibold text-ink-900">{defaultChunkCount + userChunkCount} {ui.chunkUnit}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">{ui.activeChunks}</p><p className="mt-1 font-semibold text-ink-900">{activeChunkCount} {ui.chunkUnit}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">{ui.lastImportedAt}</p><p className="mt-1 break-words font-semibold text-ink-900">{lastImportedAt ? new Date(lastImportedAt).toLocaleDateString() : ui.neverImported}</p></div></div>
          <p className="mt-3 break-words text-xs text-ink-500">{ui.activeSources}：{activeSourceTypes.join(" / ")}。用户文档禁用后仍会保留在列表中，但不会参与 /chat RAG 检索。</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3"><select value={selectedPack} onChange={(event) => setSelectedPack(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"><option value={allPackOption}>{ui.allPacks}</option>{knowledgePacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"><option value={allCategoryOption}>{ui.allCategories}</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><select value={selectedSourceType} onChange={(event) => setSelectedSourceType(event.target.value as SourceFilter)} className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"><option value={allSourceOption}>{ui.allSources}</option><option value="default">{ui.defaultSource}</option><option value="user_upload">{ui.userUpload}</option><option value="user_paste">{ui.userPaste}</option></select></div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder={ui.searchPlaceholder} />
          {notice ? <p className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-brand-700">{notice}</p> : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-ink-900">{ui.builtinSection}</h3>
            <p className="mt-1 text-sm text-ink-500">{ui.builtinDesc}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {enterpriseKnowledgePacks.map((pack) => {
              const packChunks = pack.documents.reduce((sum, document) => sum + splitDocument(document).length, 0);
              return (
                <article key={pack.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-ink-900">{pack.title}</h4>
                    <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-ink-500 ring-1 ring-slate-200">{ui.readonly}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-600">{categoryIntro(pack.packId)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-500">
                    <span>{pack.documents.length} {ui.docUnit}</span>
                    <span>{packChunks} chunks</span>
                    <span>{ui.ragIncluded}</span>
                  </div>
                  <div className="mt-3 rounded-md bg-white p-3 ring-1 ring-slate-200">
                    <p className="text-xs font-semibold text-ink-700">{ui.canAnswer}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pack.suitableQuestions.slice(0, 3).map((question) => (
                        <a key={question} href={chatQuestionHref(question)} className="rounded-md border border-brand-100 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">{question}</a>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-ink-900">{ui.userImportTitle}</h3>
            <p className="mt-1 text-sm text-ink-500">{ui.userImportDesc}</p>
          </div>
          <DocumentForm onAdd={handleAdd} existingDocuments={allDocuments} />
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h3 className="font-semibold text-ink-900">{ui.docList}</h3>
            <p className="mt-1 text-sm text-ink-500">{ui.currentFilterPrefix}{filteredDocuments.length}{ui.currentFilterSuffix}</p>
          </div>
          {filteredDocuments.map((document) => {
            const documentChunks = splitDocument(document);
            const enabled = isDocumentEnabled(document);
            const qualityIssues = documentQualityIssues(document);
            const quality = assessKnowledgeDocument(document);
            const questions = suggestedQuestions(document);
            return (
              <article key={document.id} className="border-b border-slate-100 p-4 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setSelectedDocumentId(document.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="break-words font-semibold text-ink-900">{document.title}</h4>
                      <span className={"rounded px-2 py-0.5 text-xs font-semibold ring-1 " + sourceBadgeClass(document.sourceType)}>{sourceTypeLabel(document.sourceType)}</span>
                      <span className={enabled ? "rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100" : "rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink-500 ring-1 ring-slate-200"}>{enabled ? ui.enabled : ui.disabled}</span>
                      <span className={"rounded px-2 py-0.5 text-xs font-semibold ring-1 " + qualityBadgeClass(quality.level)}>质量 {quality.score} · {quality.label}</span>
                      {document.sourceType === "default" ? <span className="rounded bg-slate-50 px-2 py-0.5 text-xs text-ink-500 ring-1 ring-slate-200">{ui.readonlyShort}</span> : null}
                    </div>
                    <p className="mt-2 break-words text-sm leading-6 text-ink-600">{document.summary ?? document.content.slice(0, 110)}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-500">
                      <span className="rounded bg-slate-50 px-2 py-1 ring-1 ring-slate-200">{document.category}</span>
                      <span className="rounded bg-slate-50 px-2 py-1 ring-1 ring-slate-200">{documentChunks.length} chunks</span>
                      <span className={enabled ? "rounded bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-100" : "rounded bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-amber-100"}>{enabled ? ui.ragIncluded : ui.ragExcluded}</span>
                      <span className="rounded bg-slate-50 px-2 py-1 ring-1 ring-slate-200">{document.updatedAt}</span>
                    </div>
                  </button>
                  {document.sourceType !== "default" ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button type="button" onClick={() => handleToggleEnabled(document.id)} className="rounded-md border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">{enabled ? ui.disable : ui.enable}</button>
                      <button type="button" onClick={() => handleDelete(document.id)} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">{ui.delete}</button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(document.tags ?? []).length ? (document.tags ?? []).slice(0, 6).map((tag) => (
                    <span key={tag} className="rounded bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">{tag}</span>
                  )) : <span className="rounded bg-slate-50 px-2 py-1 text-xs text-ink-500 ring-1 ring-slate-200">{ui.noTags}</span>}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)]">
                  <div className="rounded-md bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-ink-700">{ui.canAnswer}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {questions.slice(0, 2).map((question) => (
                        <a key={question} href={chatQuestionHref(question)} className="rounded-md border border-brand-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">{question}</a>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-ink-700">{ui.qualityPreview}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-500">{qualityIssues[0] ?? ui.noQualityIssues}</p>
                  </div>
                </div>
              </article>
            );
          })}
          {filteredDocuments.length === 0 ? <p className="p-5 text-sm text-ink-500">{ui.emptyDocs}</p> : null}
        </div>
      </section>

      <aside className="space-y-5 min-w-0">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{ui.docDetail}</p>
              <h3 className="mt-1 break-words font-semibold text-ink-900">{selectedDocument?.title ?? ui.noDocument}</h3>
            </div>
            {selectedDocument ? <span className={"rounded px-2 py-1 text-xs font-semibold ring-1 " + sourceBadgeClass(selectedDocument.sourceType)}>{sourceTypeLabel(selectedDocument.sourceType)}</span> : null}
          </div>
          {selectedDocument ? (
            <div className="mt-4 space-y-4 text-sm leading-6 text-ink-600">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-semibold text-ink-700">{ui.documentSummary}</p>
                <p className="mt-1 break-words">{selectedDocument.summary ?? selectedDocument.content.slice(0, 180)}</p>
              </div>
              <div className="grid gap-2 rounded-md bg-slate-50 p-3 text-xs sm:grid-cols-2">
                <p><span className="text-ink-400">{ui.category}</span>{selectedDocument.category}</p>
                <p><span className="text-ink-400">{ui.updatedAt}</span>{selectedDocument.updatedAt}</p>
                <p><span className="text-ink-400">{ui.chunks}</span>{chunks.length}</p>
                <p><span className="text-ink-400">{ui.source}</span>{sourceTypeLabel(selectedDocument.sourceType)}</p>
                <p><span className="text-ink-400">{ui.ragStatus}</span>{isDocumentEnabled(selectedDocument) ? ui.enabled : ui.disabled}</p>
                <p><span className="text-ink-400">可删除：</span>{isSelectedUserDocument ? "是" : "否"}</p>
                <p className="sm:col-span-2 break-words"><span className="text-ink-400">{ui.tags}</span>{(selectedDocument.tags ?? []).join(" / ") || ui.none}</p>
              </div>
              {!isDocumentEnabled(selectedDocument) ? <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">{ui.disabledNote}</p> : null}
              <div className="rounded-md bg-brand-50 p-3">
                <p className="text-xs font-semibold text-brand-700">{ui.suggestedQuestions}</p>
                <div className="mt-2 space-y-2">
                  {selectedSuggestedQuestions.map((item) => (
                    <div key={item} className="rounded-md bg-white p-2 ring-1 ring-brand-100">
                      <p className="break-words text-xs text-brand-800">{item}</p>
                      <a href={chatQuestionHref(item)} className="mt-1 inline-flex rounded-md border border-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">{ui.testInChat}</a>
                    </div>
                  ))}
                </div>
              </div>
              <div className={selectedQualityIssues.length ? "rounded-md bg-amber-50 p-3 text-xs text-amber-800" : "rounded-md bg-emerald-50 p-3 text-xs text-emerald-800"}>
                <p className="font-semibold">{selectedQuality ? `质量评分 ${selectedQuality.score}/100 · ${selectedQuality.label}` : ui.qualityDiagnosis}</p>
                {selectedQuality ? (
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] sm:grid-cols-5">
                    <span>内容 {selectedQuality.dimensions.content}/30</span>
                    <span>标签 {selectedQuality.dimensions.tags}/20</span>
                    <span>测试问题 {selectedQuality.dimensions.testQuestions}/20</span>
                    <span>分块 {selectedQuality.dimensions.chunks}/20</span>
                    <span>RAG {selectedQuality.dimensions.ragEnabled}/10</span>
                  </div>
                ) : null}
                {selectedQualityIssues.length ? (
                  <ul className="mt-2 space-y-1">
                    {selectedQualityIssues.map((issue) => <li key={issue} className="break-words">· {issue}</li>)}
                  </ul>
                ) : null}
              </div>
              {selectedDuplicateMatches.length ? (
                <div className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  <p className="font-semibold">可能存在重复内容</p>
                  {selectedDuplicateMatches.map((item) => (
                    <p key={item.documentId} className="mt-1 break-words">· {item.title}：相似度 {item.similarity}%（{item.reasons.join("、")}）</p>
                  ))}
                  <p className="mt-2 text-amber-700">该提示不会阻止保存，请结合业务版本和适用范围判断是否保留。</p>
                </div>
              ) : null}
              <div className="rounded-md border border-slate-200 p-3 text-xs leading-5 text-ink-600">
                <p className="font-semibold text-ink-800">推荐测试路径</p>
                <p className="mt-1">1. 确认文档已启用参与 RAG。</p>
                <p>2. 点击上方“测试这个问题”，进入聊天工作台。</p>
                <p>3. 检查回答来源是否命中当前文档，问题只会自动填入，不会自动运行。</p>
              </div>
              {isSelectedUserDocument ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleToggleEnabled(selectedDocument.id)} className="rounded-md border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50">{isDocumentEnabled(selectedDocument) ? ui.disable : ui.enable}</button>
                  <button type="button" onClick={() => handleDelete(selectedDocument.id)} className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">{ui.deleteThisDoc}</button>
                </div>
              ) : <p className="rounded-md bg-slate-50 p-3 text-xs text-ink-500">{ui.readonlyNote}</p>}
            </div>
          ) : null}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-ink-900">{ui.qualityDiagnosis}</h3>
          <p className="mt-1 text-sm text-ink-500">{ui.qualityOverviewDesc}</p>
          <div className="mt-3 grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
            <p>文档总数：{allDocuments.length}</p>
            <p>用户上传文档：{userDocuments.length}</p>
            <p>启用文档：{enabledDocuments.length}</p>
            <p>禁用用户文档：{disabledUserCount}</p>
            <p>chunk 总数：{defaultChunkCount + userChunkCount}</p>
            <p>参与检索 chunks：{activeChunkCount}</p>
            <p>fallback 次数：{usageDiagnostics.fallbackCount}</p>
            <p>无召回 / 低置信问题数：{usageDiagnostics.noRecallCount}</p>
            <p className="sm:col-span-2">最近导入：{lastImportedAt ? new Date(lastImportedAt).toLocaleString() : ui.noUserDocs}</p>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-ink-600">
            <div>
              <p className="font-semibold text-ink-900">被引用最多的文档</p>
              {usageDiagnostics.mostCited.length ? usageDiagnostics.mostCited.map(([id, item]) => <p key={id} className="break-words">· {item.title}：{item.count} 次</p>) : <p className="text-ink-500">暂无引用记录</p>}
            </div>
            <div>
              <p className="font-semibold text-ink-900">从未被引用的启用文档</p>
              {usageDiagnostics.neverCited.length ? usageDiagnostics.neverCited.map((document) => <p key={document.id} className="break-words">· {document.title}</p>) : <p className="text-ink-500">暂无</p>}
            </div>
            <div>
              <p className="font-semibold text-ink-900">{ui.qualityOverview}</p>
              {libraryQualityIssues.length ? libraryQualityIssues.map((item) => (
                <div key={item.document.id} className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                  <p className="break-words font-semibold">{item.document.title}</p>
                  <p className="mt-1 break-words">{item.issues.slice(0, 2).join(" / ")}</p>
                </div>
              )) : <p className="text-ink-500">{ui.noQualityIssues}</p>}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-500">诊断数据基于当前浏览器 localStorage 中的 Chat 运行历史和反馈记录，当前版本不接服务端数据库。</p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-ink-900">{ui.chunksTitle}</h3><p className="mt-1 text-sm text-ink-500">{ui.chunksDesc}</p><ChunkList chunks={chunks} /></section><MockJsonPanel title={ui.citationExample} data={chunks.slice(0, 4).map((chunk) => ({ documentId: chunk.documentId, packId: chunk.packId, sourceTitle: chunk.sourceTitle, sourceType: chunk.sourceType, category: chunk.category, tags: chunk.tags, chunkIndex: chunk.chunkIndex, keywords: chunk.keywords.slice(0, 8) }))} />
      </aside>
    </div>
  );
}


