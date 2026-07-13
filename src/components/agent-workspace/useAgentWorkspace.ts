"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { saveChatFeedback } from "@/lib/chat/feedback";
import { readUserKnowledgeDocuments } from "@/lib/knowledge/storage";
import { appendConversationTurn, clearCurrentConversation, deleteCurrentConversation, loadConversationStore, selectConversation, startNewConversation, type ConversationStore } from "@/lib/conversation/storage";
import { contextFromConversationMessages } from "@/lib/conversation/context";
import type { AgentApiResponse, ChatAnswerFeedbackValue, ConversationContextMeta, LlmMode } from "@/types";

export type LlmStatus = { configured: boolean };
export type LlmHealthResult = { configured: boolean; healthy: boolean; durationMs?: number; statusCode?: number; errorType?: string; message?: string };

type AgentErrorPayload = { errorType?: string; error?: string; message?: string };

export function useAgentWorkspace(fallbackQuestion: string) {
  const searchParams = useSearchParams();
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const conversationEpoch = useRef(0);
  const [question, setQuestion] = useState(fallbackQuestion);
  const [mode, setMode] = useState<LlmMode>("mock");
  const [result, setResult] = useState<AgentApiResponse | null>(null);
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);
  const [llmStatusError, setLlmStatusError] = useState("");
  const [healthResult, setHealthResult] = useState<LlmHealthResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [clientError, setClientError] = useState("");
  const [feedbackValues, setFeedbackValues] = useState<ChatAnswerFeedbackValue[]>([]);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [conversationStore, setConversationStore] = useState<ConversationStore | null>(null);
  const [contextMeta, setContextMeta] = useState<ConversationContextMeta | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setConversationStore(loadConversationStore().data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/llm/status", { method: "GET" });
        if (!response.ok) throw new Error(`LLM status request failed: ${response.status}`);
        const data = (await response.json()) as LlmStatus;
        if (cancelled || !mounted.current) return;
        setLlmStatus(data);
        setMode(data.configured ? "real" : "mock");
      } catch (error) {
        if (!cancelled && mounted.current) setLlmStatusError(error instanceof Error ? error.message : "无法读取 Real API 配置状态。");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const questionFromUrl = searchParams.get("question");
    if (questionFromUrl?.trim()) setQuestion(questionFromUrl.trim());
  }, [searchParams]);

  const realApiUnavailable = mode === "real" && llmStatus?.configured === false;

  const runAgent = useCallback(async () => {
    if (inFlight.current) return;
    if (realApiUnavailable) {
      setClientError("当前未配置模型服务。请使用开发模拟模式，或在服务端配置模型服务后再使用真实模型生成。");
      return;
    }
    inFlight.current = true;
    const requestEpoch = conversationEpoch.current;
    setIsLoading(true);
    setClientError("");
    try {
      const currentStore = conversationStore ?? loadConversationStore().data;
      const activeConversation = currentStore.conversations.find((item) => item.id === currentStore.activeConversationId);
      const builtContext = contextFromConversationMessages(activeConversation?.messages ?? []);
      const enabledUserDocuments = readUserKnowledgeDocuments().filter((document) => document.enabled !== false);
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode, userDocuments: enabledUserDocuments, conversationContext: builtContext.context }),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({})) as AgentErrorPayload;
        if (response.status === 429 || errorPayload.errorType === "rate_limited" || errorPayload.error === "rate_limited") {
          throw new Error(errorPayload.message || "请求过于频繁，请稍后再试。");
        }
        throw new Error(errorPayload.message || `API request failed: ${response.status}`);
      }
      const nextResult = (await response.json()) as AgentApiResponse;
      if (!mounted.current || requestEpoch !== conversationEpoch.current) return;
      setResult(nextResult);
      const savedConversation = appendConversationTurn(currentStore, question, nextResult);
      setConversationStore(savedConversation.data);
      setContextMeta({
        contextApplied: Boolean(nextResult.api.contextApplied),
        contextMessageCount: nextResult.api.contextMessageCount ?? 0,
        contextTruncated: Boolean(nextResult.api.contextTruncated),
        contextCharacterCount: nextResult.api.contextCharacterCount ?? 0,
      });
      setFeedbackValues([]);
      setFeedbackReason("");
      setFeedbackMessage("");
    } catch (error) {
      if (mounted.current) setClientError(error instanceof Error ? error.message : "Unknown client error.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setIsLoading(false);
    }
  }, [conversationStore, mode, question, realApiUnavailable]);

  const newConversation = useCallback(() => {
    if (inFlight.current) return;
    const currentStore = conversationStore ?? loadConversationStore().data;
    const next = startNewConversation(currentStore);
    conversationEpoch.current += 1;
    setConversationStore(next.data);
    setResult(null);
    setQuestion("");
    setClientError("");
    setFeedbackValues([]);
    setFeedbackReason("");
    setFeedbackMessage("");
    setContextMeta(null);
  }, [conversationStore]);

  const switchConversation = useCallback((conversationId: string) => {
    if (inFlight.current || !conversationStore) return;
    const next = selectConversation(conversationStore, conversationId);
    conversationEpoch.current += 1;
    setConversationStore(next.data);
    setResult(null);
    setContextMeta(null);
  }, [conversationStore]);

  const clearConversation = useCallback(() => {
    if (inFlight.current || !conversationStore) return;
    const next = clearCurrentConversation(conversationStore);
    conversationEpoch.current += 1;
    setConversationStore(next.data);
    setResult(null);
    setContextMeta(null);
  }, [conversationStore]);

  const deleteConversation = useCallback(() => {
    if (inFlight.current || !conversationStore) return;
    const next = deleteCurrentConversation(conversationStore);
    conversationEpoch.current += 1;
    setConversationStore(next.data);
    setResult(null);
    setContextMeta(null);
  }, [conversationStore]);

  const checkHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    setClientError("");
    try {
      const response = await fetch("/api/llm/health", { method: "POST" });
      const nextHealth = (await response.json()) as LlmHealthResult;
      if (mounted.current) setHealthResult(nextHealth);
    } catch (error) {
      if (mounted.current) setHealthResult({ configured: Boolean(llmStatus?.configured), healthy: false, errorType: "client_error", message: error instanceof Error ? error.message : "Unknown client error." });
    } finally {
      if (mounted.current) setIsCheckingHealth(false);
    }
  }, [llmStatus?.configured]);

  const toggleFeedback = useCallback((value: ChatAnswerFeedbackValue) => {
    setFeedbackValues((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }, []);

  const saveFeedback = useCallback(async () => {
    if (!result) return;
    if (!feedbackValues.length) {
      setFeedbackMessage("请先选择至少一个反馈标签。");
      return;
    }
    const saved = saveChatFeedback(result, feedbackValues, feedbackReason);
    if (!saved.ok) {
      setFeedbackMessage(saved.error);
      return;
    }
    if (!result.runId) {
      setFeedbackMessage("已保存到当前浏览器本地；本次运行缺少服务端标识，未写入服务端统计。");
      return;
    }
    setFeedbackMessage("已保存反馈到当前浏览器本地，并同步写入服务端运行摘要。");
    try {
      const response = await fetch("/api/ops/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: result.runId, values: feedbackValues, reason: feedbackReason }),
      });
      if (!response.ok && mounted.current) {
        const payload = await response.json().catch(() => ({})) as { message?: string };
        setFeedbackMessage(`已保存到当前浏览器本地；服务端统计未写入：${payload.message ?? "请求失败。"}`);
      }
    } catch {
      if (mounted.current) setFeedbackMessage("已保存反馈到当前浏览器本地；服务端摘要暂时不可写入。");
    }
  }, [feedbackReason, feedbackValues, result]);

  return {
    question, setQuestion, mode, setMode, result, llmStatus, llmStatusError, healthResult,
    isLoading, isCheckingHealth, clientError, feedbackValues, feedbackReason, setFeedbackReason,
    feedbackMessage, realApiUnavailable, runAgent, checkHealth, toggleFeedback, saveFeedback,
    conversationId: conversationStore?.activeConversationId ?? "",
    conversations: conversationStore?.conversations ?? [],
    conversationMessages: conversationStore?.conversations.find((item) => item.id === conversationStore.activeConversationId)?.messages ?? [],
    contextMeta, newConversation, switchConversation, clearConversation, deleteConversation,
  };
}
