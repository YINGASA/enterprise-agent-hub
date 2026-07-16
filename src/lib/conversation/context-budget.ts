import type { ContextBudgetConfig, ContextSectionUsage, ContextTruncationReason } from "@/types";

export const DEFAULT_CONTEXT_BUDGET: ContextBudgetConfig = {
  modelContextTokens: 8_192,
  reservedOutputTokens: 1_200,
  maximumInputTokens: 6_800,
  safetyMarginTokens: 500,
  systemInstructionsTokens: 1_100,
  currentUserMessageTokens: 900,
  recentMessagesTokens: 1_700,
  selectedHistoryTokens: 800,
  conversationSummaryTokens: 700,
  ragEvidenceTokens: 800,
  toolResultsTokens: 300,
};

export type ContextBudgetValidation =
  | { ok: true; config: ContextBudgetConfig; usableSectionTokens: number }
  | { ok: false; errors: string[] };

export type ContextBudgetResult = {
  usage: ContextSectionUsage;
  budgetLimit: number;
  usableSectionTokens: number;
  remainingTokens: number;
  remainingSectionTokens: number;
  exceedsMaximumInput: boolean;
  exceedsUsableSectionBudget: boolean;
  truncationReason: ContextTruncationReason;
};

const configKeys: Array<keyof ContextBudgetConfig> = [
  "modelContextTokens", "reservedOutputTokens", "maximumInputTokens", "safetyMarginTokens",
  "systemInstructionsTokens", "currentUserMessageTokens", "recentMessagesTokens", "selectedHistoryTokens",
  "conversationSummaryTokens", "ragEvidenceTokens", "toolResultsTokens",
];

const sectionKeys: Array<keyof Omit<ContextSectionUsage, "totalInputEstimate">> = [
  "systemInstructions", "currentUserMessage", "recentMessages", "selectedHistory", "conversationSummary", "ragEvidence", "toolResults",
];

function isValidTokenCount(value: number) {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function softSectionTotal(config: ContextBudgetConfig) {
  return config.systemInstructionsTokens + config.currentUserMessageTokens + config.recentMessagesTokens +
    config.selectedHistoryTokens + config.conversationSummaryTokens + config.ragEvidenceTokens + config.toolResultsTokens;
}

export function validateContextBudgetConfig(config: ContextBudgetConfig): ContextBudgetValidation {
  const errors = configKeys.flatMap((key) => isValidTokenCount(config[key]) ? [] : [`${key} 必须是非负有限整数。`]);
  if (errors.length) return { ok: false, errors };
  if (config.reservedOutputTokens >= config.modelContextTokens) errors.push("reservedOutputTokens 必须小于 modelContextTokens。");
  if (config.maximumInputTokens <= 0) errors.push("maximumInputTokens 必须大于 0。");
  if (config.maximumInputTokens + config.reservedOutputTokens > config.modelContextTokens) errors.push("maximumInputTokens 与 reservedOutputTokens 不能超过 modelContextTokens。");
  if (config.safetyMarginTokens >= config.maximumInputTokens) errors.push("safetyMarginTokens 必须小于 maximumInputTokens。");
  const usableSectionTokens = config.maximumInputTokens - config.safetyMarginTokens;
  if (usableSectionTokens <= 0) errors.push("预算中没有可用的 section 输入空间。");
  if (softSectionTotal(config) > usableSectionTokens) errors.push("分区软上限总和不能超过可用 section 预算。");
  return errors.length ? { ok: false, errors } : { ok: true, config: { ...config }, usableSectionTokens };
}

export function resolveContextBudgetConfig(overrides: Partial<ContextBudgetConfig> = {}): ContextBudgetConfig {
  const config = { ...DEFAULT_CONTEXT_BUDGET, ...overrides };
  const validation = validateContextBudgetConfig(config);
  if (!validation.ok) throw new Error(`Invalid context budget configuration: ${validation.errors.join(" ")}`);
  return validation.config;
}

export function emptyContextSectionUsage(): ContextSectionUsage {
  return { systemInstructions: 0, currentUserMessage: 0, recentMessages: 0, selectedHistory: 0, conversationSummary: 0, ragEvidence: 0, toolResults: 0, totalInputEstimate: 0 };
}

export function calculateContextSectionUsage(sections: Omit<ContextSectionUsage, "totalInputEstimate">): ContextSectionUsage {
  const safeSections = sectionKeys.reduce((result, key) => ({ ...result, [key]: isValidTokenCount(sections[key]) ? sections[key] : 0 }), {} as Omit<ContextSectionUsage, "totalInputEstimate">);
  return { ...safeSections, totalInputEstimate: sectionKeys.reduce((total, key) => total + safeSections[key], 0) };
}

export function evaluateContextBudget(usage: ContextSectionUsage, config: ContextBudgetConfig = DEFAULT_CONTEXT_BUDGET): ContextBudgetResult {
  const validation = validateContextBudgetConfig(config);
  if (!validation.ok) throw new Error(`Invalid context budget configuration: ${validation.errors.join(" ")}`);
  const normalizedUsage = calculateContextSectionUsage(usage);
  const exceedsMaximumInput = normalizedUsage.totalInputEstimate > config.maximumInputTokens;
  const exceedsUsableSectionBudget = normalizedUsage.totalInputEstimate > validation.usableSectionTokens;
  const truncationReason: ContextTruncationReason = exceedsMaximumInput
    ? "priority_sections_exceed_budget"
    : exceedsUsableSectionBudget ? "safety_margin_exceeded" : "none";
  return {
    usage: normalizedUsage,
    budgetLimit: config.maximumInputTokens,
    usableSectionTokens: validation.usableSectionTokens,
    remainingTokens: Math.max(0, config.maximumInputTokens - normalizedUsage.totalInputEstimate),
    remainingSectionTokens: Math.max(0, validation.usableSectionTokens - normalizedUsage.totalInputEstimate),
    exceedsMaximumInput,
    exceedsUsableSectionBudget,
    truncationReason,
  };
}
