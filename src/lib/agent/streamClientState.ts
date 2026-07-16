import type { AgentStreamEvent, AgentStreamPhase } from "@/types";

export type StreamAnswerAccumulator = {
  answer: string;
  deltaCount: number;
  seenIndexes: ReadonlySet<number>;
};

export function createStreamAnswerAccumulator(): StreamAnswerAccumulator {
  return { answer: "", deltaCount: 0, seenIndexes: new Set<number>() };
}

export function appendStreamAnswerDelta(
  current: StreamAnswerAccumulator,
  event: Extract<AgentStreamEvent, { type: "answer_delta" }>,
): StreamAnswerAccumulator {
  if (current.seenIndexes.has(event.index)) return current;
  const seenIndexes = new Set(current.seenIndexes);
  seenIndexes.add(event.index);
  return {
    answer: current.answer + event.delta,
    deltaCount: current.deltaCount + 1,
    seenIndexes,
  };
}

export function completeStreamAnswer(
  current: StreamAnswerAccumulator,
  event: Extract<AgentStreamEvent, { type: "answer_completed" }>,
): StreamAnswerAccumulator {
  return {
    ...current,
    answer: event.result.finalAnswer,
    deltaCount: event.deltaCount,
  };
}

export function shouldStopStreamingRequest(activeRequestId: string | null, completedRequestId: string | null) {
  return Boolean(activeRequestId) && activeRequestId !== completedRequestId;
}

export function appendStreamPhase(phases: readonly AgentStreamPhase[], phase: AgentStreamPhase) {
  return phases.includes(phase) ? phases : [...phases, phase];
}
