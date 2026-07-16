import type { RetrievalConfidence, RetrieverMode } from "./knowledge";

export type ChatRunHistoryItem = {
  id: string;
  createdAt: string;
  question: string;
  finalAnswer: string;
  responseMode: string;
  scenario: string;
  intent: string;
  confidence?: number;
  riskLevel?: string;
  needsClarification?: boolean;
  fallback?: boolean;
  fallbackReason?: string;
  toolsUsed?: string[];
  sourcesCount?: number;
  retrievalConfidence?: RetrievalConfidence;
  retrieverMode?: RetrieverMode;
  rerankReason?: string;
  durationMs?: number;
  resultSnapshot?: unknown;
};

export type ChatAnswerFeedbackValue = "positive" | "negative" | "accurate" | "inaccurate";

export type ChatAnswerFeedbackItem = {
  id: string;
  createdAt: string;
  question: string;
  answerPreview: string;
  values: ChatAnswerFeedbackValue[];
  reason?: string;
  scenario: string;
  intent: string;
  responseMode: string;
  sourceTitles: string[];
  retrievalConfidence?: RetrievalConfidence;
  fallback?: boolean;
};

export type ChatFeedbackSummary = {
  total: number;
  helpfulCount: number;
  notHelpfulCount: number;
  accurateCount: number;
  inaccurateCount: number;
  helpfulRate: number;
  citationAccuracyRate: number;
  commonIssueTypes: string[];
  recent: ChatAnswerFeedbackItem[];
};
