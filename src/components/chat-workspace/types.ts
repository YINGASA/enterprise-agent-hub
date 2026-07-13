import type { AgentApiResponse, AgentRequestAction, AgentStreamPhase, ChatAnswerFeedbackValue } from "@/types";

export type TransientChatTurn = {
  requestId: string;
  action: AgentRequestAction;
  conversationId: string;
  userMessageId: string;
  targetUserMessageId?: string;
  targetAssistantMessageId?: string;
  question: string;
  createdAt: string;
  status: "pending" | "streaming" | "failed" | "stopped";
  phase?: AgentStreamPhase;
  phases?: AgentStreamPhase[];
  partialAnswer?: string;
  runId?: string;
  deltaCount?: number;
  retryable?: boolean;
  error?: string;
};

export type MessageFeedbackDraft = {
  values: ChatAnswerFeedbackValue[];
  reason: string;
  message: string;
};

export type MessageResultMap = Record<string, AgentApiResponse>;
