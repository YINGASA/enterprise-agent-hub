import type { AgentApiResponse, LlmGenerateResult, LlmMode } from "./agent";

export type AgentStreamPhase = "understand" | "retrieve" | "tool" | "generate" | "complete";

export type AgentStreamMetadata = {
  streamingRequested: true;
  streamingUsed: boolean;
  streamFallback: boolean;
  deltaCount: number;
};

export type AgentStreamEvent =
  | {
      type: "run_started";
      runId: string;
      requestedMode: LlmMode;
      responseMode: LlmMode;
      contextApplied: boolean;
      contextMessageCount: number;
      contextTruncated: boolean;
    }
  | {
      type: "phase";
      phase: AgentStreamPhase;
    }
  | {
      type: "answer_delta";
      delta: string;
      index: number;
    }
  | ({
      type: "answer_completed";
      result: AgentApiResponse;
    } & AgentStreamMetadata)
  | {
      type: "run_error";
      code: "invalid_stream" | "network_error" | "rate_limited" | "server_error" | "timeout_error";
      message: string;
      retryable: boolean;
    }
  | {
      type: "run_aborted";
      message: string;
    };

export type LlmStreamResult = LlmGenerateResult & Omit<AgentStreamMetadata, "streamingRequested">;
