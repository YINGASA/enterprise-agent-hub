import type { ContextEvidence, ContextMessage, ContextToolResult } from "@/types";

/**
 * A deterministic, deliberately conservative approximation for planning a
 * context window. It is not a replacement for a provider-specific tokenizer:
 * different models tokenize the same text differently. The estimate only
 * provides a stable safety boundary when no provider tokenizer is available.
 */

function isCjk(character: string) {
  const code = character.codePointAt(0) ?? 0;
  return (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) || (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0xac00 && code <= 0xd7af);
}

function isAsciiLetterOrDigit(character: string) {
  return /^[A-Za-z0-9]$/.test(character);
}

/** Returns a non-negative, finite token estimate for arbitrary text. */
export function estimateTextTokens(text: string): number {
  if (!text) return 0;

  let estimate = 0;
  let asciiRunLength = 0;
  const flushAsciiRun = () => {
    if (asciiRunLength > 0) {
      // Four ASCII characters per token is common, but round up and add a
      // small boundary cost to avoid underestimating compact JSON/identifiers.
      estimate += Math.ceil(asciiRunLength / 4) + 1;
      asciiRunLength = 0;
    }
  };

  for (const character of text) {
    if (isAsciiLetterOrDigit(character)) {
      asciiRunLength += 1;
      continue;
    }
    flushAsciiRun();
    if (/\s/u.test(character)) continue;
    if (isCjk(character)) {
      estimate += 1;
      continue;
    }
    // Punctuation, emoji, symbols and JSON delimiters are commonly separate
    // tokens or token boundaries, so count each one conservatively.
    estimate += 1;
  }
  flushAsciiRun();
  return Math.max(0, Math.ceil(estimate));
}

export function estimateMessageTokens(message: ContextMessage): number {
  // Role framing accounts for chat-format overhead without modeling a specific
  // provider protocol.
  return 4 + estimateTextTokens(message.content);
}

export function estimateMessagesTokens(messages: readonly ContextMessage[]): number {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

export function estimateEvidenceTokens(evidence: readonly ContextEvidence[]): number {
  return evidence.reduce((total, item) => total + 3 + estimateTextTokens(item.sourceTitle ?? "") + estimateTextTokens(item.content), 0);
}

export function estimateToolResultTokens(results: readonly ContextToolResult[]): number {
  return results.reduce((total, item) => total + 4 + estimateTextTokens(item.tool) + estimateTextTokens(item.status) + estimateTextTokens(item.content), 0);
}
