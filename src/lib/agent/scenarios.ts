export const ACTIVE_AGENT_SCENARIOS = ["enterprise", "ecommerce", "ai_engineering", "general"] as const;

export type ActiveAgentScenario = (typeof ACTIVE_AGENT_SCENARIOS)[number];

const activeScenarioSet = new Set<string>(ACTIVE_AGENT_SCENARIOS);

export function isActiveAgentScenario(value: unknown): value is ActiveAgentScenario {
  return typeof value === "string" && activeScenarioSet.has(value);
}

export function normalizeActiveAgentScenario(value: unknown, fallback: unknown): ActiveAgentScenario {
  if (isActiveAgentScenario(value)) return value;
  return isActiveAgentScenario(fallback) ? fallback : "general";
}
