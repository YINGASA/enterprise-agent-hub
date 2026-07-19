"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { documents as defaultDocuments } from "@/data/mock";
import { loadChatFeedback } from "@/lib/chat/feedback";
import { loadChatHistory } from "@/lib/chat/history";
import { invalidateKnowledgeDerived } from "@/lib/knowledge/derived";
import { findDuplicateKnowledgeDocuments } from "@/lib/knowledge/quality";
import { loadRagTestHistory } from "@/lib/knowledge/ragTestHistory";
import { readUserKnowledgeDocumentsWithStatus } from "@/lib/knowledge/storage";
import { KnowledgeRepositoryError, LocalKnowledgeRepository, ServerKnowledgeRepository } from "@/lib/storage/knowledgeRepository";
import { getClientStorageStatus, type PublicStorageStatus } from "@/lib/storage/status";
import type { ChatAnswerFeedbackItem, ChatRunHistoryItem, ImportedKnowledgeDocument, KnowledgeDocument, KnowledgeSourceType, RagTestHistoryItem } from "@/types";

const allPackOption = "all";
const allCategoryOption = "all";
const allSourceOption = "all";
const localKnowledgeRepository = new LocalKnowledgeRepository();
const serverKnowledgeRepository = new ServerKnowledgeRepository();
const degradedStorageStatus: PublicStorageStatus = { configured: true, healthy: false, storageMode: "degraded", databaseType: "postgresql" };

function isStorageUnavailable(error: unknown) {
  return error instanceof KnowledgeRepositoryError && error.status >= 500;
}

export type SourceFilter = typeof allSourceOption | KnowledgeSourceType;

export function useKnowledgeWorkspace() {
  const storageHydrationEpoch = useRef(0);
  const [userDocuments, setUserDocuments] = useState<ImportedKnowledgeDocument[]>([]);
  const [selectedPack, setSelectedPack] = useState(allPackOption);
  const [selectedCategory, setSelectedCategory] = useState(allCategoryOption);
  const [selectedSourceType, setSelectedSourceType] = useState<SourceFilter>(allSourceOption);
  const [search, setSearch] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState(defaultDocuments[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatRunHistoryItem[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<ChatAnswerFeedbackItem[]>([]);
  const [ragTestHistory, setRagTestHistory] = useState<RagTestHistoryItem[]>([]);
  const [testBenchQuestion, setTestBenchQuestion] = useState("");
  const [storageStatus, setStorageStatus] = useState<PublicStorageStatus | null>(null);

  const hydrateStorage = useCallback(async (force = false) => {
    const hydrationEpoch = storageHydrationEpoch.current + 1;
    storageHydrationEpoch.current = hydrationEpoch;
    if (force) setStorageStatus(null);
    const status = await getClientStorageStatus(force);
    if (hydrationEpoch !== storageHydrationEpoch.current) return;

    if (status.storageMode !== "server") {
      const loaded = readUserKnowledgeDocumentsWithStatus();
      setUserDocuments(loaded.data);
      setStorageStatus(status);
      if (!loaded.ok) setNotice(`用户文档读取失败：${loaded.error}`);
      else setNotice(status.storageMode === "degraded" ? "服务端存储暂不可用，当前显示本地只读缓存；写操作已暂停。" : "");
      return;
    }

    try {
      const documents = await serverKnowledgeRepository.list();
      if (hydrationEpoch !== storageHydrationEpoch.current) return;
      setUserDocuments(documents);
      setStorageStatus(status);
      setNotice("");
    } catch (error) {
      if (hydrationEpoch !== storageHydrationEpoch.current) return;
      setUserDocuments(readUserKnowledgeDocumentsWithStatus().data);
      setStorageStatus(degradedStorageStatus);
      setNotice(error instanceof Error ? error.message : "服务端知识存储暂不可用。");
    }
  }, []);

  const refreshStorage = useCallback(() => hydrateStorage(true), [hydrateStorage]);

  useEffect(() => {
    setChatHistory(loadChatHistory().data);
    setFeedbackItems(loadChatFeedback().data);
    const loadedRagTests = loadRagTestHistory();
    setRagTestHistory(loadedRagTests.data);
    if (!loadedRagTests.ok) setNotice(loadedRagTests.error);
    void hydrateStorage();
    return () => { storageHydrationEpoch.current += 1; };
  }, [hydrateStorage]);

  async function handleAdd(document: ImportedKnowledgeDocument, allDocuments: KnowledgeDocument[]) {
    if (!storageStatus) {
      setNotice("正在加载存储工作区，请稍后再试。");
      return false;
    }
    const status = storageStatus;
    if (status.storageMode === "degraded") {
      setNotice("服务端存储暂不可用，文档未保存。请恢复后重试。");
      return false;
    }
    const duplicates = findDuplicateKnowledgeDocuments(document, allDocuments);
    let savedDocument: ImportedKnowledgeDocument | null = null;
    try {
      const repository = status.storageMode === "server" ? serverKnowledgeRepository : localKnowledgeRepository;
      savedDocument = await repository.create(document);
      setUserDocuments((current) => [savedDocument!, ...current.filter((item) => item.id !== savedDocument!.id)]);
      invalidateKnowledgeDerived(savedDocument.id);
      const chunkCount = (await repository.listChunks(savedDocument.id)).length;
      setSelectedDocumentId(savedDocument.id);
      setSelectedPack(savedDocument.packId ?? allPackOption);
      setSelectedCategory(allCategoryOption);
      setSelectedSourceType(savedDocument.sourceType);
      setNotice(`已成功导入：${savedDocument.title}。${status.storageMode === "server" ? "已保存到服务端工作区" : "已保存到当前浏览器本地"}，刷新页面后仍会保留；已生成 ${chunkCount} 个 chunks，${savedDocument.enabled === false ? "当前未启用 RAG 检索" : "已加入 RAG 检索"}。${duplicates.length ? ` 检测到可能重复文档：${duplicates.map((item) => item.title).join("、")}。` : ""}`);
      return true;
    } catch (error) {
      if (savedDocument) {
        if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
        setSelectedDocumentId(savedDocument.id);
        setSelectedPack(savedDocument.packId ?? allPackOption);
        setSelectedCategory(allCategoryOption);
        setSelectedSourceType(savedDocument.sourceType);
        setNotice(`已成功导入：${savedDocument.title}，但 chunk 统计暂时无法刷新。文档已经保存，请稍后重试查看。`);
        return true;
      }
      if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
      setNotice(`导入失败：${error instanceof Error ? error.message : "存储请求失败。"}`);
      return false;
    }
  }

  async function handleDelete(documentId: string) {
    const target = userDocuments.find((document) => document.id === documentId);
    if (!target) return;
    if (!storageStatus) {
      setNotice("正在加载存储工作区，请稍后再试。");
      return false;
    }
    const status = storageStatus;
    if (status.storageMode === "degraded") {
      setNotice("服务端存储暂不可用，文档未删除。");
      return;
    }
    try {
      const repository = status.storageMode === "server" ? serverKnowledgeRepository : localKnowledgeRepository;
      await repository.remove(documentId);
      const savedDocuments = userDocuments.filter((document) => document.id !== documentId);
      invalidateKnowledgeDerived(documentId);
      setUserDocuments(savedDocuments);
      if (selectedDocumentId === documentId) setSelectedDocumentId(savedDocuments[0]?.id ?? defaultDocuments[0]?.id ?? "");
      setNotice(`已删除用户文档：${target.title}`);
    } catch (error) {
      if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
      setNotice(`删除失败：${error instanceof Error ? error.message : "存储请求失败。"}`);
    }
  }

  async function handleToggleEnabled(documentId: string) {
    const target = userDocuments.find((document) => document.id === documentId);
    if (!target) return;
    if (!storageStatus) {
      setNotice("正在加载存储工作区，请稍后再试。");
      return;
    }
    const status = storageStatus;
    if (status.storageMode === "degraded") {
      setNotice("服务端存储暂不可用，文档状态未更新。");
      return;
    }
    try {
      const repository = status.storageMode === "server" ? serverKnowledgeRepository : localKnowledgeRepository;
      const updated = await repository.update(documentId, { enabled: target.enabled === false });
      invalidateKnowledgeDerived(documentId);
      setUserDocuments((current) => current.map((document) => document.id === documentId ? updated : document));
      setNotice(`${target.title} 已${target.enabled === false ? "启用" : "禁用"} RAG 检索。`);
    } catch (error) {
      if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
      setNotice(`状态更新失败：${error instanceof Error ? error.message : "存储请求失败。"}`);
    }
  }

  async function handleClearUserDocuments(confirmed = false) {
    if (!userDocuments.length || (!confirmed && !window.confirm("确认清空所有用户导入文档吗？默认知识库不会被删除。"))) return;
    if (!storageStatus) {
      setNotice("正在加载存储工作区，请稍后再试。");
      return;
    }
    const status = storageStatus;
    if (status.storageMode === "degraded") {
      setNotice("服务端存储暂不可用，文档未清空。");
      return;
    }
    const repository = status.storageMode === "server" ? serverKnowledgeRepository : localKnowledgeRepository;
    const results = await Promise.allSettled(userDocuments.map((document) => repository.remove(document.id)));
    const removedIds = new Set(userDocuments.flatMap((document, index) => results[index]?.status === "fulfilled" ? [document.id] : []));
    removedIds.forEach((documentId) => invalidateKnowledgeDerived(documentId));
    const remaining = userDocuments.filter((document) => !removedIds.has(document.id));
    setUserDocuments(remaining);
    if (!remaining.some((document) => document.id === selectedDocumentId)) setSelectedDocumentId(remaining[0]?.id ?? defaultDocuments[0]?.id ?? "");
    if (!remaining.length) setSelectedSourceType(allSourceOption);
    const failed = results.length - removedIds.size;
    if (failed) {
      if (results.some((result) => result.status === "rejected" && isStorageUnavailable(result.reason))) setStorageStatus(degradedStorageStatus);
      setNotice(`已删除 ${removedIds.size} 篇文档，另有 ${failed} 篇删除失败；当前列表已按实际成功结果更新。`);
    } else {
      setNotice("已清空用户文档。默认知识库保持可用。");
    }
  }

  async function handleRestore(documents: ImportedKnowledgeDocument[]) {
    if (!storageStatus) {
      setNotice("正在加载存储工作区，请稍后再试。");
      return false;
    }
    const status = storageStatus;
    if (status.storageMode === "degraded") {
      setNotice("服务端存储暂不可用，知识库备份未恢复。");
      return false;
    }
    try {
      const repository = status.storageMode === "server" ? serverKnowledgeRepository : localKnowledgeRepository;
      const savedDocuments = await repository.replaceAll(documents);

      userDocuments.forEach((document) => invalidateKnowledgeDerived(document.id));
      savedDocuments.forEach((document) => invalidateKnowledgeDerived(document.id));
      setUserDocuments(savedDocuments);
      setSelectedDocumentId(savedDocuments[0]?.id ?? defaultDocuments[0]?.id ?? "");
      setSelectedSourceType(allSourceOption);
      setNotice(`用户知识库备份已恢复，默认知识库未受影响；当前存储中共有 ${savedDocuments.length} 篇用户文档。`);
      return true;
    } catch (error) {
      if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
      setNotice(`备份恢复失败：${error instanceof Error ? error.message : "存储请求失败。"}`);
      return false;
    }
  }

  return {
    userDocuments, storageStatus, refreshStorage, selectedPack, setSelectedPack, selectedCategory, setSelectedCategory,
    selectedSourceType, setSelectedSourceType, search, setSearch, selectedDocumentId,
    setSelectedDocumentId, notice, chatHistory, feedbackItems, ragTestHistory, setRagTestHistory,
    testBenchQuestion, setTestBenchQuestion, handleAdd, handleDelete, handleToggleEnabled,
    handleClearUserDocuments, handleRestore,
  };
}
