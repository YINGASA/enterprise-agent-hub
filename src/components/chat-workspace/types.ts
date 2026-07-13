import type { AgentApiResponse, ChatAnswerFeedbackValue } from "@/types";

export type TransientChatTurn = {
  requestId: string;
  conversationId: string;
  userMessageId: string;
  question: string;
  createdAt: string;
  status: "pending" | "failed";
  error?: string;
};

export type MessageFeedbackDraft = {
  values: ChatAnswerFeedbackValue[];
  reason: string;
  message: string;
};

export type MessageResultMap = Record<string, AgentApiResponse>;
