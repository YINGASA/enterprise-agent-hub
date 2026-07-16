export type Feature = {
  title: string;
  description: string;
};

export type Scenario = {
  id: string;
  name: string;
  description: string;
  questions: string[];
  tools: string[];
  outputType: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentDecision = {
  step: string;
  detail: string;
  status: "done" | "pending";
};

export type ToolCallLog = {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

/** `recruitment` is retained only to parse and display records created before V2.0.4. */
export type AgentScenario = "enterprise" | "ecommerce" | "recruitment" | "ai_engineering" | "general";
