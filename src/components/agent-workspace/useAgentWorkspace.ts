"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { saveConversationMessageFeedback } from "@/lib/chat/feedback";
import { readUserKnowledgeDocuments } from "@/lib/knowledge/storage";
import {
  appendConversationTurnToConversation,
  clearCurrentConversation,
  createConversation,
  deleteConversation as deleteStoredConversation,
  loadConversationStore,
  renameConversation as renameStoredConversation,
  selectConversation,
  type ConversationStore,
} from "@/lib/conversation/storage";
import { contextFromConversationMessages } from "@/lib/conversation/context";
import { parseAgentStreamResponse } from "@/lib/agent/streamProtocol";
import { appendStreamAnswerDelta, appendStreamPhase, completeStreamAnswer, createStreamAnswerAccumulator, shouldStopStreamingRequest } from "@/lib/agent/streamClientState";
import type { MessageFeedbackDraft, MessageResultMap, TransientChatTurn } from "@/components/chat-workspace/types";
import type { AgentApiResponse, AgentStreamEvent, ChatAnswerFeedbackValue, Conversation, ConversationMessage, LlmMode } from "@/types";

export type LlmStatus = { configured: boolean };
export type LlmHealthResult = { configured: boolean; healthy: boolean; durationMs?: number; statusCode?: number; errorType?: string; message?: string };

type AgentErrorPayload = { errorType?: string; error?: string; message?: string };

const emptyFeedbackDraft = (): MessageFeedbackDraft => ({ values: [], reason: "", message: "" });
const makeRequestId = () => `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const makeMessageId = () => `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function findAssistantMessage(store: ConversationStore, conversationId: string, result: AgentApiResponse) {
  const messages = store.conversations.find((conversation) => conversation.id === conversationId)?.messages ?? [];
  return messages.slice().reverse().find((message) => message.role === "assistant" && (result.runId ? message.runId === result.runId : message.content === result.finalAnswer));
}

function previousUserQuestion(messages: ConversationMessage[], assistantMessageId: string) {
  const index = messages.findIndex((message) => message.id === assistantMessageId);
  if (index < 0) return "";
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (messages[cursor]?.role === "user") return messages[cursor]?.content ?? "";
  }
  return "";
}

export function useAgentWorkspace(initialQuestion = "") {
  const searchParams = useSearchParams();
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const conversationEpoch = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const activeRequestId = useRef<string | null>(null);
  const completedRequestId = useRef<string | null>(null);
  const storeRef = useRef<ConversationStore | null>(null);
  const draftConversationRef = useRef<Conversation | null>(null);
  const prefillApplied = useRef(false);
  const [question, setQuestion] = useState(initialQuestion);
  const [mode, setMode] = useState<LlmMode>("mock");
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);
  const [llmStatusError, setLlmStatusError] = useState("");
  const [healthResult, setHealthResult] = useState<LlmHealthResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [clientError, setClientError] = useState("");
  const [conversationStore, setConversationStore] = useState<ConversationStore | null>(null);
  const [draftConversation, setDraftConversation] = useState<Conversation | null>(null);
  const [transientTurn, setTransientTurn] = useState<TransientChatTurn | null>(null);
  const [resultsByMessageId, setResultsByMessageId] = useState<MessageResultMap>({});
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<Record<string, MessageFeedbackDraft>>({});

  const commitStore = useCallback((store: ConversationStore) => {
    storeRef.current = store;
    setConversationStore(store);
  }, []);

  const commitDraft = useCallback((conversation: Conversation | null) => {
    draftConversationRef.current = conversation;
    setDraftConversation(conversation);
  }, []);

  const cancelActiveRequest = useCallback(() => {
    conversationEpoch.current += 1;
    abortController.current?.abort();
    abortController.current = null;
    activeRequestId.current = null;
    completedRequestId.current = null;
    inFlight.current = false;
    setIsLoading(false);
    setTransientTurn(null);
    setClientError("");
  }, []);

  useEffect(() => {
    mounted.current = true;
    const loaded = loadConversationStore().data;
    commitStore(loaded);
    return () => {
      mounted.current = false;
      abortController.current?.abort();
    };
  }, [commitStore]);

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
        if (!cancelled && mounted.current) setLlmStatusError(error instanceof Error ? error.message : "无法读取模型服务配置状态。");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (prefillApplied.current) return;
    const questionFromUrl = searchParams.get("question");
    if (questionFromUrl?.trim()) setQuestion(questionFromUrl.trim());
    prefillApplied.current = true;
  }, [searchParams]);

  const activeConversation = useMemo(() => {
    if (draftConversation) return draftConversation;
    return conversationStore?.conversations.find((conversation) => conversation.id === conversationStore.activeConversationId) ?? null;
  }, [conversationStore, draftConversation]);
  const conversationId = activeConversation?.id ?? "";
  const conversationMessages = activeConversation?.messages ?? [];
  const latestAssistant = conversationMessages.slice().reverse().find((message) => message.role === "assistant");
  const currentResult = latestAssistant ? resultsByMessageId[latestAssistant.id] ?? null : null;
  const realApiUnavailable = mode === "real" && llmStatus?.configured === false;

  const runAgent = useCallback(async (retryQuestion?: string) => {
    const submittedQuestion = (retryQuestion ?? question).trim();
    if (!submittedQuestion || inFlight.current) return;
    if (realApiUnavailable) {
      setClientError("当前未配置模型服务。请切换到开发模拟模式后再发送。");
      return;
    }

    const baseStore = storeRef.current ?? loadConversationStore().data;
    if (!storeRef.current) commitStore(baseStore);
    let originConversation = draftConversationRef.current ?? baseStore.conversations.find((conversation) => conversation.id === baseStore.activeConversationId) ?? null;
    if (!originConversation) {
      originConversation = createConversation();
      commitDraft(originConversation);
    }
    const requestId = makeRequestId();
    const retryingTurn = transientTurn && (transientTurn.status === "failed" || transientTurn.status === "stopped") && transientTurn.conversationId === originConversation.id && transientTurn.question === submittedQuestion ? transientTurn : null;
    const turn: TransientChatTurn = {
      requestId,
      conversationId: originConversation.id,
      userMessageId: retryingTurn?.userMessageId ?? makeMessageId(),
      question: submittedQuestion,
      createdAt: retryingTurn?.createdAt ?? new Date().toISOString(),
      status: "pending",
      phases: [],
      partialAnswer: "",
      deltaCount: 0,
      retryable: false,
    };
    const requestEpoch = conversationEpoch.current;
    const controller = new AbortController();
    abortController.current = controller;
    activeRequestId.current = requestId;
    completedRequestId.current = null;
    inFlight.current = true;
    setIsLoading(true);
    setClientError("");
    setTransientTurn(turn);

    try {
      const builtContext = contextFromConversationMessages(originConversation.messages);
      const enabledUserDocuments = readUserKnowledgeDocuments().filter((document) => document.enabled !== false);
      const requestBody = JSON.stringify({ question: submittedQuestion, mode, userDocuments: enabledUserDocuments, conversationContext: builtContext.context });
      const streamReadingSupported = typeof ReadableStream !== "undefined" && typeof TextDecoder !== "undefined";
      const response = await fetch(streamReadingSupported ? "/api/agent/stream" : "/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({})) as AgentErrorPayload;
        if (response.status === 429 || errorPayload.errorType === "rate_limited" || errorPayload.error === "rate_limited") throw new Error(errorPayload.message || "请求过于频繁，请稍后再试。");
        throw new Error(errorPayload.message || `API request failed: ${response.status}`);
      }

      let nextResult: AgentApiResponse | null = null;
      let streamError: Extract<AgentStreamEvent, { type: "run_error" }> | null = null;
      let streamAborted = false;
      let answerAccumulator = createStreamAnswerAccumulator();
      let pendingFrame: number | null = null;

      const isCurrentRequest = () => mounted.current && !controller.signal.aborted && requestEpoch === conversationEpoch.current && abortController.current === controller;
      const flushPartialAnswer = () => {
        pendingFrame = null;
        if (!isCurrentRequest()) return;
        setTransientTurn((current) => current?.requestId === requestId ? { ...current, status: "streaming", partialAnswer: answerAccumulator.answer, deltaCount: answerAccumulator.deltaCount } : current);
      };
      const schedulePartialAnswer = () => {
        if (pendingFrame !== null || !isCurrentRequest()) return;
        pendingFrame = window.requestAnimationFrame(flushPartialAnswer);
      };
      const applyEvent = (event: AgentStreamEvent) => {
        if (!isCurrentRequest()) return;
        if (event.type === "run_started") {
          setTransientTurn((current) => current?.requestId === requestId ? { ...current, status: "streaming", runId: event.runId } : current);
          return;
        }
        if (event.type === "phase") {
          setTransientTurn((current) => current?.requestId === requestId
            ? { ...current, status: "streaming", phase: event.phase, phases: [...appendStreamPhase(current.phases ?? [], event.phase)] }
            : current);
          return;
        }
        if (event.type === "answer_delta") {
          const nextAccumulator = appendStreamAnswerDelta(answerAccumulator, event);
          if (nextAccumulator === answerAccumulator) return;
          answerAccumulator = nextAccumulator;
          schedulePartialAnswer();
          return;
        }
        if (event.type === "answer_completed") {
          completedRequestId.current = requestId;
          nextResult = event.result;
          answerAccumulator = completeStreamAnswer(answerAccumulator, event);
          if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
          flushPartialAnswer();
          return;
        }
        if (event.type === "run_error") {
          streamError = event;
          return;
        }
        streamAborted = true;
      };

      try {
        if (!streamReadingSupported) {
          nextResult = (await response.json()) as AgentApiResponse;
        } else if (response.body && typeof response.body.getReader === "function") {
          await parseAgentStreamResponse(response, applyEvent, controller.signal);
        } else {
          throw new Error("当前浏览器无法读取流式回答，请重试。");
        }
      } catch (error) {
        if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
        flushPartialAnswer();
        throw error;
      }

      if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
      flushPartialAnswer();
      if (streamAborted && isCurrentRequest()) {
        setTransientTurn((current) => current?.requestId === requestId ? { ...current, status: "stopped", retryable: true, error: "已停止生成。" } : current);
        return;
      }
      if (streamError) {
        const safeError = streamError as Extract<AgentStreamEvent, { type: "run_error" }>;
        const error = new Error(safeError.message);
        Object.assign(error, { retryable: safeError.retryable });
        throw error;
      }
      if (!nextResult) throw new Error("流式回答未正常完成，请重试。");
      const completedResult = nextResult;
      if (!mounted.current || controller.signal.aborted || requestEpoch !== conversationEpoch.current) return;

      const latestStore = storeRef.current ?? baseStore;
      let workingStore = latestStore;
      if (!latestStore.conversations.some((conversation) => conversation.id === originConversation.id)) {
        if (draftConversationRef.current?.id !== originConversation.id) return;
        workingStore = { ...latestStore, activeConversationId: originConversation.id, conversations: [originConversation, ...latestStore.conversations] };
      }
      const saved = appendConversationTurnToConversation(workingStore, originConversation.id, submittedQuestion, completedResult);
      if (!saved.ok) throw new Error("error" in saved && saved.error ? saved.error : "会话写入失败。");
      const assistantMessage = findAssistantMessage(saved.data, originConversation.id, completedResult);
      if (!assistantMessage) throw new Error("回答已生成，但无法关联到当前会话。");
      commitStore(saved.data);
      if (draftConversationRef.current?.id === originConversation.id) commitDraft(null);
      setResultsByMessageId((current) => ({ ...current, [assistantMessage.id]: completedResult }));
      setFeedbackByMessageId((current) => ({ ...current, [assistantMessage.id]: emptyFeedbackDraft() }));
      setTransientTurn(null);
      setQuestion("");
    } catch (error) {
      if (controller.signal.aborted || requestEpoch !== conversationEpoch.current) return;
      const message = error instanceof Error ? error.message : "请求失败，请稍后重试。";
      setClientError(message);
      const retryable = typeof error === "object" && error !== null && "retryable" in error ? error.retryable !== false : true;
      setTransientTurn((current) => current?.requestId === requestId ? { ...current, status: "failed", error: message, retryable } : { ...turn, status: "failed", error: message, retryable });
    } finally {
      if (abortController.current === controller) {
        abortController.current = null;
        if (activeRequestId.current === requestId) activeRequestId.current = null;
        if (completedRequestId.current === requestId) completedRequestId.current = null;
        inFlight.current = false;
        if (mounted.current) setIsLoading(false);
      }
    }
  }, [commitDraft, commitStore, mode, question, realApiUnavailable, transientTurn]);

  const retryLastTurn = useCallback(() => {
    if (transientTurn && (transientTurn.status === "failed" || transientTurn.status === "stopped") && transientTurn.retryable !== false) void runAgent(transientTurn.question);
  }, [runAgent, transientTurn]);

  const stopGeneration = useCallback(() => {
    if (!inFlight.current || !shouldStopStreamingRequest(activeRequestId.current, completedRequestId.current)) return;
    conversationEpoch.current += 1;
    const controller = abortController.current;
    abortController.current = null;
    activeRequestId.current = null;
    completedRequestId.current = null;
    inFlight.current = false;
    controller?.abort();
    setIsLoading(false);
    setClientError("");
    setTransientTurn((current) => current && (current.status === "pending" || current.status === "streaming")
      ? { ...current, status: "stopped", retryable: true, error: "已停止生成。" }
      : current);
  }, []);

  const newConversation = useCallback(() => {
    cancelActiveRequest();
    const current = draftConversationRef.current ?? storeRef.current?.conversations.find((conversation) => conversation.id === storeRef.current?.activeConversationId) ?? null;
    setQuestion("");
    if (current && current.messages.length === 0) return;
    commitDraft(createConversation());
  }, [cancelActiveRequest, commitDraft]);

  const switchConversation = useCallback((conversationIdToSelect: string) => {
    const store = storeRef.current;
    if (!store || !store.conversations.some((conversation) => conversation.id === conversationIdToSelect)) return;
    cancelActiveRequest();
    commitDraft(null);
    const selected = selectConversation(store, conversationIdToSelect);
    if (selected.ok) commitStore(selected.data);
    setQuestion("");
  }, [cancelActiveRequest, commitDraft, commitStore]);

  const clearConversation = useCallback(() => {
    cancelActiveRequest();
    if (draftConversationRef.current) {
      commitDraft(createConversation());
      setQuestion("");
      return;
    }
    const store = storeRef.current;
    if (!store) return;
    const cleared = clearCurrentConversation(store);
    if (cleared.ok) commitStore(cleared.data);
    setQuestion("");
  }, [cancelActiveRequest, commitDraft, commitStore]);

  const deleteConversation = useCallback((conversationIdToDelete: string) => {
    if (draftConversationRef.current?.id === conversationIdToDelete) {
      cancelActiveRequest();
      commitDraft(createConversation());
      setQuestion("");
      return;
    }
    const store = storeRef.current;
    if (!store) return;
    const deletingVisiblePersistedConversation = !draftConversationRef.current && store.activeConversationId === conversationIdToDelete;
    if (deletingVisiblePersistedConversation) cancelActiveRequest();
    const deleted = deleteStoredConversation(store, conversationIdToDelete);
    if (deleted.ok) {
      commitStore(deleted.data);
      if (deletingVisiblePersistedConversation) commitDraft(null);
    }
  }, [cancelActiveRequest, commitDraft, commitStore]);

  const renameConversation = useCallback((conversationIdToRename: string, title: string) => {
    const store = storeRef.current;
    if (!store) return "会话尚未加载完成。";
    const renamed = renameStoredConversation(store, conversationIdToRename, title);
    if (!renamed.ok) return renamed.error ?? "重命名会话失败。";
    commitStore(renamed.data);
    return null;
  }, [commitStore]);

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

  const toggleFeedback = useCallback((messageId: string, value: ChatAnswerFeedbackValue) => {
    setFeedbackByMessageId((current) => {
      const draft = current[messageId] ?? emptyFeedbackDraft();
      const values = draft.values.includes(value) ? draft.values.filter((item) => item !== value) : [...draft.values, value];
      return { ...current, [messageId]: { ...draft, values, message: "" } };
    });
  }, []);

  const setFeedbackReason = useCallback((messageId: string, reason: string) => {
    setFeedbackByMessageId((current) => ({ ...current, [messageId]: { ...(current[messageId] ?? emptyFeedbackDraft()), reason, message: "" } }));
  }, []);

  const saveFeedback = useCallback(async (messageId: string) => {
    const store = storeRef.current;
    const conversation = store?.conversations.find((item) => item.messages.some((message) => message.id === messageId));
    const message = conversation?.messages.find((item) => item.id === messageId);
    const draft = feedbackByMessageId[messageId] ?? emptyFeedbackDraft();
    if (!conversation || !message || message.role !== "assistant") return;
    if (!draft.values.length) {
      setFeedbackByMessageId((current) => ({ ...current, [messageId]: { ...draft, message: "请先选择至少一个反馈标签。" } }));
      return;
    }
    const questionForMessage = previousUserQuestion(conversation.messages, messageId);
    const saved = saveConversationMessageFeedback(questionForMessage, message, draft.values, draft.reason);
    if (!saved.ok) {
      setFeedbackByMessageId((current) => ({ ...current, [messageId]: { ...draft, message: saved.error } }));
      return;
    }
    let feedbackMessage = message.runId ? "反馈已保存并关联到本次回答。" : "反馈已保存到当前浏览器；本次回答没有服务端运行标识。";
    if (message.runId) {
      try {
        const response = await fetch("/api/ops/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: message.runId, values: draft.values, reason: draft.reason }) });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { message?: string };
          feedbackMessage = `反馈已保存到当前浏览器；服务端统计未写入：${payload.message ?? "请求失败。"}`;
        }
      } catch {
        feedbackMessage = "反馈已保存到当前浏览器；服务端统计暂时不可用。";
      }
    }
    if (mounted.current) setFeedbackByMessageId((current) => ({ ...current, [messageId]: { ...draft, message: feedbackMessage } }));
  }, [feedbackByMessageId]);

  return {
    question, setQuestion, mode, setMode, result: currentResult, llmStatus, llmStatusError, healthResult,
    isLoading, isCheckingHealth, clientError, realApiUnavailable, runAgent, retryLastTurn, stopGeneration, checkHealth,
    conversationId, conversations: conversationStore?.conversations ?? [], conversationMessages,
    activeConversation, transientTurn, resultsByMessageId, feedbackByMessageId,
    newConversation, switchConversation, clearConversation, deleteConversation, renameConversation,
    toggleFeedback, setFeedbackReason, saveFeedback,
  };
}
