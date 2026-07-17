"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { saveConversationMessageFeedback } from "@/lib/chat/feedback";
import { readUserKnowledgeDocuments } from "@/lib/knowledge/storage";
import {
  appendConversationTurnToConversation,
  createConversation,
  loadConversationStore,
  getLastCompletedTurn,
  replaceLastCompletedAssistant,
  replaceLastCompletedTurn,
  selectConversation,
  type ConversationStore,
} from "@/lib/conversation/storage";
import { toContextCandidates, toConversationSummaryDto } from "@/lib/conversation/context-candidates";
import { parseAgentStreamResponse } from "@/lib/agent/streamProtocol";
import { appendStreamAnswerDelta, appendStreamPhase, completeStreamAnswer, createStreamAnswerAccumulator, shouldStopStreamingRequest } from "@/lib/agent/streamClientState";
import { ConversationRepositoryError, LocalConversationRepository, ServerConversationRepository } from "@/lib/storage/conversationRepository";
import { mergeConversationIntoStore, toConversationStore } from "@/lib/storage/conversationStoreState";
import { getClientStorageStatus, type PublicStorageStatus } from "@/lib/storage/status";
import type { MessageFeedbackDraft, MessageResultMap, TransientChatTurn } from "@/components/chat-workspace/types";
import type { AgentApiResponse, AgentRequestAction, AgentStreamEvent, ChatAnswerFeedbackValue, Conversation, ConversationMessage, LlmMode } from "@/types";

export type LlmStatus = { configured: boolean };
export type LlmHealthResult = { configured: boolean; healthy: boolean; durationMs?: number; statusCode?: number; errorType?: string; message?: string };

type AgentErrorPayload = { errorType?: string; error?: string; message?: string };
type ExecuteTurnInput = {
  action: AgentRequestAction;
  question?: string;
  targetUserMessageId?: string;
  targetAssistantMessageId?: string;
  transientUserMessageId?: string;
  createdAt?: string;
};

const emptyFeedbackDraft = (): MessageFeedbackDraft => ({ values: [], reason: "", message: "" });
const makeRequestId = () => `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const makeMessageId = () => `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const localConversationRepository = new LocalConversationRepository();
const serverConversationRepository = new ServerConversationRepository();
const degradedStorageStatus: PublicStorageStatus = { configured: true, healthy: false, storageMode: "degraded", databaseType: "postgresql" };

function isStorageUnavailable(error: unknown) {
  return error instanceof ConversationRepositoryError && error.code === "unavailable";
}

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
  const storageHydrationEpoch = useRef(0);
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
  const [storageStatus, setStorageStatus] = useState<PublicStorageStatus | null>(null);
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

  const hydrateStorage = useCallback(async (force = false) => {
    const hydrationEpoch = storageHydrationEpoch.current + 1;
    storageHydrationEpoch.current = hydrationEpoch;
    if (force) setStorageStatus(null);
    const status = await getClientStorageStatus(force);
    if (!mounted.current || hydrationEpoch !== storageHydrationEpoch.current) return;

    if (status.storageMode !== "server") {
      commitDraft(null);
      commitStore(loadConversationStore().data);
      setStorageStatus(status);
      setClientError(status.storageMode === "degraded" ? "服务端存储暂不可用，当前仅可查看本地缓存，写操作已暂停。" : "");
      return;
    }

    try {
      const conversations = await serverConversationRepository.list();
      if (!mounted.current || hydrationEpoch !== storageHydrationEpoch.current) return;
      commitDraft(null);
      commitStore(toConversationStore(conversations, storeRef.current?.activeConversationId));
      setStorageStatus(status);
      setClientError("");
    } catch (error) {
      if (!mounted.current || hydrationEpoch !== storageHydrationEpoch.current) return;
      commitDraft(null);
      commitStore(loadConversationStore().data);
      setStorageStatus(degradedStorageStatus);
      setClientError(error instanceof Error ? error.message : "服务端存储暂不可用，写操作已暂停。");
    }
  }, [commitDraft, commitStore]);

  const refreshStorage = useCallback(() => hydrateStorage(true), [hydrateStorage]);

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
    void hydrateStorage();
    return () => {
      storageHydrationEpoch.current += 1;
      mounted.current = false;
      abortController.current?.abort();
    };
  }, [hydrateStorage]);

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

  const executeTurn = useCallback(async (input: ExecuteTurnInput) => {
    const submittedQuestion = (input.question ?? question).trim();
    if (!submittedQuestion || inFlight.current) return;
    if (realApiUnavailable) {
      setClientError("当前未配置模型服务。请切换到开发模拟模式后再发送。");
      return;
    }

    if (!storageStatus) {
      setClientError("正在加载存储工作区，请稍后再试。");
      return;
    }
    const effectiveStorageStatus = storageStatus;
    if (effectiveStorageStatus.storageMode === "degraded") {
      setClientError("服务端存储暂不可用，本次写入未执行。请等待恢复后重试。");
      return;
    }
    let baseStore = storeRef.current ?? (effectiveStorageStatus.storageMode === "local" ? loadConversationStore().data : toConversationStore([]));
    if (!storeRef.current) commitStore(baseStore);
    const targetsRevision = Boolean(input.targetAssistantMessageId || input.targetUserMessageId);
    let originConversation = effectiveStorageStatus.storageMode === "local"
      ? draftConversationRef.current ?? baseStore.conversations.find((conversation) => conversation.id === baseStore.activeConversationId) ?? null
      : baseStore.conversations.find((conversation) => conversation.id === baseStore.activeConversationId) ?? null;
    if (!originConversation) {
      if (targetsRevision) return;
      if (effectiveStorageStatus.storageMode === "server") {
        try {
          originConversation = await serverConversationRepository.create();
          if (!mounted.current) return;
          baseStore = mergeConversationIntoStore(storeRef.current ?? baseStore, originConversation, { activate: true });
          commitDraft(null);
          commitStore(baseStore);
        } catch (error) {
          if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
          setClientError(error instanceof Error ? error.message : "服务端存储暂不可用，本次写入未执行。");
          return;
        }
      } else {
        originConversation = createConversation();
        commitDraft(originConversation);
      }
    }
    const completedTurn = getLastCompletedTurn(originConversation);
    if (targetsRevision && (!completedTurn
      || completedTurn.userMessage.id !== input.targetUserMessageId
      || completedTurn.assistantMessage.id !== input.targetAssistantMessageId)) return;
    const requestId = makeRequestId();
    const turn: TransientChatTurn = {
      requestId,
      action: input.action,
      conversationId: originConversation.id,
      userMessageId: input.transientUserMessageId ?? input.targetUserMessageId ?? makeMessageId(),
      targetUserMessageId: input.targetUserMessageId,
      targetAssistantMessageId: input.targetAssistantMessageId,
      question: submittedQuestion,
      createdAt: input.createdAt ?? new Date().toISOString(),
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
      const contextMessages = targetsRevision && completedTurn ? completedTurn.contextMessages : originConversation.messages;
      const contextCandidates = toContextCandidates(contextMessages);
      const conversationSummary = toConversationSummaryDto(originConversation.conversationSummary, contextMessages);
      const enabledUserDocuments = effectiveStorageStatus.storageMode === "server"
        ? []
        : readUserKnowledgeDocuments().filter((document) => document.enabled !== false);
      const requestBody = JSON.stringify({ question: submittedQuestion, mode, requestAction: input.action, userDocuments: enabledUserDocuments, contextCandidates, ...(conversationSummary ? { conversationSummary } : {}) });
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

      const summaryPatch = answerAccumulator.conversationSummaryPatch ?? completedResult.conversationSummaryPatch;
      let savedStore: ConversationStore;
      if (effectiveStorageStatus.storageMode === "server") {
        if (!(storeRef.current ?? baseStore).conversations.some((conversation) => conversation.id === originConversation.id)) return;
        const savedConversation = input.targetAssistantMessageId
          ? (input.action === "edit_resend" || (input.action === "retry" && input.targetUserMessageId && submittedQuestion !== completedTurn?.userMessage.content)
            ? await serverConversationRepository.editAndResendLastTurn({
              conversationId: originConversation.id,
              expectedRevision: originConversation.revision,
              expectedUserMessageId: input.targetUserMessageId!,
              expectedAssistantMessageId: input.targetAssistantMessageId,
              question: submittedQuestion,
              result: completedResult,
              conversationSummaryPatch: summaryPatch,
            })
            : await serverConversationRepository.regenerateLastAssistant({
              conversationId: originConversation.id,
              expectedRevision: originConversation.revision,
              expectedAssistantMessageId: input.targetAssistantMessageId,
              result: completedResult,
              conversationSummaryPatch: summaryPatch,
            }))
          : await serverConversationRepository.appendTurn({
            conversationId: originConversation.id,
            expectedRevision: originConversation.revision,
            question: submittedQuestion,
            result: completedResult,
            conversationSummaryPatch: summaryPatch,
          });
        if (!mounted.current || controller.signal.aborted || requestEpoch !== conversationEpoch.current) return;
        savedStore = mergeConversationIntoStore(storeRef.current ?? baseStore, savedConversation);
      } else {
        const latestStore = storeRef.current ?? baseStore;
        let workingStore = latestStore;
        if (!latestStore.conversations.some((conversation) => conversation.id === originConversation.id)) {
          if (draftConversationRef.current?.id !== originConversation.id) return;
          workingStore = { ...latestStore, activeConversationId: originConversation.id, conversations: [originConversation, ...latestStore.conversations] };
        }
        const saved = input.targetAssistantMessageId
          ? (input.action === "edit_resend" || (input.action === "retry" && input.targetUserMessageId && submittedQuestion !== completedTurn?.userMessage.content)
            ? replaceLastCompletedTurn(workingStore, originConversation.id, submittedQuestion, completedResult, { userMessageId: input.targetUserMessageId!, assistantMessageId: input.targetAssistantMessageId }, summaryPatch)
            : replaceLastCompletedAssistant(workingStore, originConversation.id, completedResult, input.targetAssistantMessageId, summaryPatch))
          : appendConversationTurnToConversation(workingStore, originConversation.id, submittedQuestion, completedResult, summaryPatch);
        if (!saved.ok) throw new Error("error" in saved && typeof saved.error === "string" ? saved.error : "会话写入失败。");
        savedStore = saved.data;
      }
      const assistantMessage = findAssistantMessage(savedStore, originConversation.id, completedResult);
      if (!assistantMessage) throw new Error("回答已生成，但无法关联到当前会话。");
      commitStore(savedStore);
      if (draftConversationRef.current?.id === originConversation.id) commitDraft(null);
      setResultsByMessageId((current) => {
        const next = { ...current };
        if (input.targetAssistantMessageId) delete next[input.targetAssistantMessageId];
        next[assistantMessage.id] = completedResult;
        return next;
      });
      setFeedbackByMessageId((current) => {
        const next = { ...current };
        if (input.targetAssistantMessageId) delete next[input.targetAssistantMessageId];
        next[assistantMessage.id] = emptyFeedbackDraft();
        return next;
      });
      setTransientTurn(null);
      if (!input.targetAssistantMessageId) setQuestion("");
    } catch (error) {
      if (controller.signal.aborted || requestEpoch !== conversationEpoch.current) return;
      if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
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
  }, [commitDraft, commitStore, mode, question, realApiUnavailable, storageStatus]);

  const runAgent = useCallback((retryQuestion?: string) => executeTurn({ action: retryQuestion ? "retry" : "send", question: retryQuestion }), [executeTurn]);

  const retryLastTurn = useCallback(() => {
    if (!transientTurn || (transientTurn.status !== "failed" && transientTurn.status !== "stopped") || transientTurn.retryable === false) return;
    void executeTurn({
      action: "retry",
      question: transientTurn.question,
      targetUserMessageId: transientTurn.targetUserMessageId,
      targetAssistantMessageId: transientTurn.targetAssistantMessageId,
      transientUserMessageId: transientTurn.userMessageId,
      createdAt: transientTurn.createdAt,
    });
  }, [executeTurn, transientTurn]);

  const regenerateLastAnswer = useCallback((assistantMessageId: string) => {
    const store = storeRef.current;
    const conversation = store?.conversations.find((item) => item.id === store.activeConversationId);
    const turn = conversation ? getLastCompletedTurn(conversation) : null;
    if (!turn || turn.assistantMessage.id !== assistantMessageId) return;
    void executeTurn({ action: "regenerate", question: turn.userMessage.content, targetUserMessageId: turn.userMessage.id, targetAssistantMessageId: turn.assistantMessage.id, createdAt: turn.userMessage.createdAt });
  }, [executeTurn]);

  const editAndResendLastQuestion = useCallback((userMessageId: string, nextQuestion: string) => {
    const store = storeRef.current;
    const conversation = store?.conversations.find((item) => item.id === store.activeConversationId);
    const turn = conversation ? getLastCompletedTurn(conversation) : null;
    const submittedQuestion = nextQuestion.trim();
    if (!turn || turn.userMessage.id !== userMessageId || !submittedQuestion || submittedQuestion === turn.userMessage.content.trim()) return;
    void executeTurn({ action: "edit_resend", question: submittedQuestion, targetUserMessageId: turn.userMessage.id, targetAssistantMessageId: turn.assistantMessage.id, createdAt: turn.userMessage.createdAt });
  }, [executeTurn]);

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
    void (async () => {
      if (!storageStatus) {
        setClientError("正在加载存储工作区，请稍后再试。");
        return;
      }
      const status = storageStatus;
      if (status.storageMode === "degraded") {
        setClientError("服务端存储暂不可用，无法新建会话。");
        return;
      }
      cancelActiveRequest();
      const current = draftConversationRef.current ?? storeRef.current?.conversations.find((conversation) => conversation.id === storeRef.current?.activeConversationId) ?? null;
      setQuestion("");
      if (current && current.messages.length === 0) return;
      if (status.storageMode === "local") {
        commitDraft(createConversation());
        return;
      }
      try {
        const activeConversationIdBeforeCreate = storeRef.current?.activeConversationId ?? "";
        const created = await serverConversationRepository.create();
        if (!mounted.current) return;
        commitDraft(null);
        const latestStore = storeRef.current ?? toConversationStore([]);
        commitStore(mergeConversationIntoStore(latestStore, created, { activate: latestStore.activeConversationId === activeConversationIdBeforeCreate }));
      } catch (error) {
        if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
        if (mounted.current) setClientError(error instanceof Error ? error.message : "新建会话失败。");
      }
    })();
  }, [cancelActiveRequest, commitDraft, commitStore, storageStatus]);

  const switchConversation = useCallback((conversationIdToSelect: string) => {
    const store = storeRef.current;
    if (!store || !store.conversations.some((conversation) => conversation.id === conversationIdToSelect)) return;
    cancelActiveRequest();
    commitDraft(null);
    if (storageStatus?.storageMode === "server") {
      commitStore({ ...store, activeConversationId: conversationIdToSelect });
    } else {
      const selected = selectConversation(store, conversationIdToSelect);
      if (selected.ok) commitStore(selected.data);
    }
    setQuestion("");
  }, [cancelActiveRequest, commitDraft, commitStore, storageStatus?.storageMode]);

  const clearConversation = useCallback(() => {
    void (async () => {
      if (!storageStatus) {
        setClientError("正在加载存储工作区，请稍后再试。");
        return;
      }
      const status = storageStatus;
      if (status.storageMode === "degraded") {
        setClientError("服务端存储暂不可用，无法清空会话。");
        return;
      }
      cancelActiveRequest();
      if (draftConversationRef.current && status.storageMode === "local") {
        commitDraft(createConversation());
        setQuestion("");
        return;
      }
      const store = storeRef.current;
      const current = store?.conversations.find((item) => item.id === store.activeConversationId);
      if (!store || !current) return;
      try {
        const cleared = status.storageMode === "server"
          ? await serverConversationRepository.clear({ conversationId: current.id, expectedRevision: current.revision })
          : await localConversationRepository.clear({ conversationId: current.id, expectedRevision: current.revision });
        if (!mounted.current) return;
        commitStore(status.storageMode === "server"
          ? mergeConversationIntoStore(storeRef.current ?? store, cleared)
          : loadConversationStore().data);
        setQuestion("");
      } catch (error) {
        if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
        if (mounted.current) setClientError(error instanceof Error ? error.message : "清空会话失败。");
      }
    })();
  }, [cancelActiveRequest, commitDraft, commitStore, storageStatus]);

  const deleteConversation = useCallback((conversationIdToDelete: string) => {
    if (draftConversationRef.current?.id === conversationIdToDelete) {
      cancelActiveRequest();
      commitDraft(createConversation());
      setQuestion("");
      return;
    }
    void (async () => {
      if (!storageStatus) {
        setClientError("正在加载存储工作区，请稍后再试。");
        return;
      }
      const status = storageStatus;
      if (status.storageMode === "degraded") {
        setClientError("服务端存储暂不可用，无法删除会话。");
        return;
      }
      const store = storeRef.current;
      const target = store?.conversations.find((item) => item.id === conversationIdToDelete);
      if (!store || !target) return;
      const deletingVisiblePersistedConversation = !draftConversationRef.current && store.activeConversationId === conversationIdToDelete;
      if (deletingVisiblePersistedConversation) cancelActiveRequest();
      try {
        const repository = status.storageMode === "server" ? serverConversationRepository : localConversationRepository;
        await repository.remove({ conversationId: target.id, expectedRevision: target.revision });
        if (!mounted.current) return;
        if (status.storageMode === "local") {
          commitStore(loadConversationStore().data);
        } else {
          const latestStore = storeRef.current ?? store;
          const remaining = latestStore.conversations.filter((item) => item.id !== target.id);
          commitStore(toConversationStore(remaining, latestStore.activeConversationId === target.id ? undefined : latestStore.activeConversationId));
        }
        if (deletingVisiblePersistedConversation) commitDraft(null);
      } catch (error) {
        if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
        if (mounted.current) setClientError(error instanceof Error ? error.message : "删除会话失败。");
      }
    })();
  }, [cancelActiveRequest, commitDraft, commitStore, storageStatus]);

  const renameConversation = useCallback(async (conversationIdToRename: string, title: string) => {
    if (!storageStatus) return "正在加载存储工作区，请稍后再试。";
    const status = storageStatus;
    if (status.storageMode === "degraded") return "服务端存储暂不可用，无法重命名会话。";
    const store = storeRef.current;
    if (!store) return "会话尚未加载完成。";
    const target = store.conversations.find((item) => item.id === conversationIdToRename);
    if (!target) return "会话不存在。";
    try {
      const repository = status.storageMode === "server" ? serverConversationRepository : localConversationRepository;
      const renamed = await repository.rename({ conversationId: target.id, expectedRevision: target.revision, title });
      if (!mounted.current) return "";
      commitStore(status.storageMode === "server"
        ? mergeConversationIntoStore(storeRef.current ?? store, renamed)
        : loadConversationStore().data);
      return null;
    } catch (error) {
      if (isStorageUnavailable(error)) setStorageStatus(degradedStorageStatus);
      return error instanceof Error ? error.message : "重命名会话失败。";
    }
  }, [commitStore, storageStatus]);

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
    const activeConversation = store?.conversations.find((item) => item.id === store.activeConversationId);
    const activeTurn = activeConversation ? getLastCompletedTurn(activeConversation) : null;
    if (conversation.id !== activeConversation?.id || activeTurn?.assistantMessage.id !== messageId) return;
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
    isLoading, isCheckingHealth, clientError, storageStatus, refreshStorage, realApiUnavailable, runAgent, retryLastTurn, regenerateLastAnswer, editAndResendLastQuestion, stopGeneration, checkHealth,
    conversationId, conversations: conversationStore?.conversations ?? [], conversationMessages,
    activeConversation, transientTurn, resultsByMessageId, feedbackByMessageId,
    newConversation, switchConversation, clearConversation, deleteConversation, renameConversation,
    toggleFeedback, setFeedbackReason, saveFeedback,
  };
}
