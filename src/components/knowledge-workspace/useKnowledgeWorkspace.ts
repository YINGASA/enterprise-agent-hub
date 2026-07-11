"use client";

import { useEffect, useState } from "react";
import { documents as defaultDocuments } from "@/data/mock";
import { loadChatFeedback } from "@/lib/chat/feedback";
import { loadChatHistory } from "@/lib/chat/history";
import { getKnowledgeDerived, invalidateKnowledgeDerived } from "@/lib/knowledge/derived";
import { findDuplicateKnowledgeDocuments } from "@/lib/knowledge/quality";
import { loadRagTestHistory } from "@/lib/knowledge/ragTestHistory";
import { clearUserKnowledgeDocuments, deleteUserKnowledgeDocument, readUserKnowledgeDocumentsWithStatus, updateUserDocumentEnabled, writeUserKnowledgeDocuments } from "@/lib/knowledge/storage";
import type { ChatAnswerFeedbackItem, ChatRunHistoryItem, ImportedKnowledgeDocument, KnowledgeDocument, KnowledgeSourceType, RagTestHistoryItem } from "@/types";

const allPackOption = "all";
const allCategoryOption = "all";
const allSourceOption = "all";

export type SourceFilter = typeof allSourceOption | KnowledgeSourceType;

export function useKnowledgeWorkspace() {
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

  useEffect(() => {
    const loaded = readUserKnowledgeDocumentsWithStatus();
    setUserDocuments(loaded.data);
    if (!loaded.ok) setNotice(`用户文档读取失败：${loaded.error}`);
    setChatHistory(loadChatHistory().data);
    setFeedbackItems(loadChatFeedback().data);
    const loadedRagTests = loadRagTestHistory();
    setRagTestHistory(loadedRagTests.data);
    if (!loadedRagTests.ok) setNotice(loadedRagTests.error);
  }, []);

  function handleAdd(document: ImportedKnowledgeDocument, allDocuments: KnowledgeDocument[]) {
    const duplicates = findDuplicateKnowledgeDocuments(document, allDocuments);
    const saved = writeUserKnowledgeDocuments([document, ...userDocuments.filter((item) => item.id !== document.id)]);
    if (!saved.ok) {
      setNotice(`导入失败：${saved.error}`);
      return;
    }
    invalidateKnowledgeDerived(document.id);
    const chunkCount = getKnowledgeDerived(document).chunks.length;
    setUserDocuments(saved.data);
    setSelectedDocumentId(document.id);
    setSelectedPack(document.packId ?? allPackOption);
    setSelectedCategory(allCategoryOption);
    setSelectedSourceType(document.sourceType);
    setNotice(`已成功导入：${document.title}。已保存到当前浏览器本地，刷新页面后仍会保留；已生成 ${chunkCount} 个 chunks，${document.enabled === false ? "当前未启用 RAG 检索" : "已加入 RAG 检索"}。${duplicates.length ? ` 检测到可能重复文档：${duplicates.map((item) => item.title).join("、")}。` : ""}`);
  }

  function handleDelete(documentId: string) {
    const target = userDocuments.find((document) => document.id === documentId);
    if (!target) return;
    const saved = deleteUserKnowledgeDocument(userDocuments, documentId);
    if (!saved.ok) {
      setNotice(`删除失败：${saved.error}`);
      return;
    }
    invalidateKnowledgeDerived(documentId);
    setUserDocuments(saved.data);
    if (selectedDocumentId === documentId) {
      setSelectedDocumentId(saved.data[0]?.id ?? defaultDocuments[0]?.id ?? "");
    }
    setNotice(`已删除用户文档：${target.title}`);
  }

  function handleToggleEnabled(documentId: string) {
    const target = userDocuments.find((document) => document.id === documentId);
    if (!target) return;
    const saved = updateUserDocumentEnabled(userDocuments, documentId, target.enabled === false);
    if (!saved.ok) {
      setNotice(`状态更新失败：${saved.error}`);
      return;
    }
    invalidateKnowledgeDerived(documentId);
    setUserDocuments(saved.data);
    setNotice(`${target.title} 已${target.enabled === false ? "启用" : "禁用"} RAG 检索。`);
  }

  function handleClearUserDocuments() {
    if (!userDocuments.length || !window.confirm("确认清空所有用户导入文档吗？默认知识库不会被删除。")) return;
    const cleared = clearUserKnowledgeDocuments();
    if (!cleared.ok) {
      setNotice(`清空失败：${cleared.error}`);
      return;
    }
    userDocuments.forEach((document) => invalidateKnowledgeDerived(document.id));
    setUserDocuments(cleared.data);
    setSelectedDocumentId(defaultDocuments[0]?.id ?? "");
    setSelectedSourceType(allSourceOption);
    setNotice("已清空用户文档。默认知识库保持可用。");
  }

  function handleRestore(documents: ImportedKnowledgeDocument[]) {
    userDocuments.forEach((document) => invalidateKnowledgeDerived(document.id));
    documents.forEach((document) => invalidateKnowledgeDerived(document.id));
    setUserDocuments(documents);
    setSelectedDocumentId(documents[0]?.id ?? defaultDocuments[0]?.id ?? "");
    setSelectedSourceType(allSourceOption);
    setNotice("用户知识库备份已恢复，默认知识库未受影响。");
  }

  return {
    userDocuments, selectedPack, setSelectedPack, selectedCategory, setSelectedCategory,
    selectedSourceType, setSelectedSourceType, search, setSearch, selectedDocumentId,
    setSelectedDocumentId, notice, chatHistory, feedbackItems, ragTestHistory, setRagTestHistory,
    testBenchQuestion, setTestBenchQuestion, handleAdd, handleDelete, handleToggleEnabled,
    handleClearUserDocuments, handleRestore,
  };
}
