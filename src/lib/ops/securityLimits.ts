const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const agentRequestLimits = {
  questionChars: 2_000,
  userDocuments: 12,
  documentIdChars: 128,
  documentTitleChars: 160,
  documentCategoryChars: 80,
  documentContentChars: 120_000,
  documentSummaryChars: 600,
  documentTags: 12,
  documentTagChars: 48,
  documentSuggestedQuestions: 5,
  documentSuggestedQuestionChars: 240,
  userDocumentTotalChars: 300_000,
} as const;

export const realApiLimits = {
  perMinute: positiveInteger(process.env["EAH_REAL_API_RATE_LIMIT_PER_MINUTE"], 12),
  maxBuckets: positiveInteger(process.env["EAH_REAL_API_RATE_LIMIT_MAX_BUCKETS"], 2_000),
  healthCacheMs: 60_000,
  evaluationDefaultCases: 3,
  evaluationMaxCases: 5,
} as const;

export const trustedClientIpHeader = process.env["EAH_TRUSTED_CLIENT_IP_HEADER"]?.trim().toLowerCase();
