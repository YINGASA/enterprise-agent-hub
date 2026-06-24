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

export type KnowledgeDocument = {
  id: string;
  title: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  source?: string;
  owner?: string;
  chunks?: Array<{
    id: string;
    content: string;
    score: number;
  }>;
  citations?: string[];
  isDefault?: boolean;
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  sourceTitle: string;
  category: string;
  chunkIndex: number;
  content: string;
  keywords: string[];
};

export type RetrievedChunk = {
  chunk: KnowledgeChunk;
  score: number;
  matchedKeywords: string[];
};

export type RagAnswer = {
  question: string;
  answer: string;
  retrievedChunks: RetrievedChunk[];
  sources: Array<{
    documentId: string;
    title: string;
    category: string;
    chunkIndexes: number[];
  }>;
  mode: "mock-rag";
  createdAt: string;
};

export type CompanyPolicy = {
  id: string;
  title: string;
  category: "expense" | "vacation" | "leave" | "security";
  summary: string;
  rules: string[];
  updatedAt: string;
};

export type PolicyDocument = {
  id: string;
  title: string;
  category: string;
  content: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  sizeAdvice: string;
  stock: number;
  sellingPoints: string[];
};

export type Order = {
  id: string;
  user: string;
  productId: string;
  productName: string;
  status: "paid" | "picking" | "shipped" | "signed" | "refunding" | "closed";
  signedAt: string | null;
  opened: boolean;
  returnSupported: boolean;
};

export type AfterSalePolicy = {
  id: string;
  title: string;
  category: "return" | "quality" | "opened_limit" | "special_goods";
  rules: string[];
  updatedAt: string;
};

export type JobDescription = {
  id: string;
  title: string;
  level: string;
  keywords: string[];
  responsibilities: string[];
  requirements: string[];
};

export type ResumeProfile = {
  id: string;
  name: string;
  summary: string;
  skills: string[];
  projects: string[];
};

export type InterviewQuestion = {
  id: string;
  jobId: string;
  question: string;
  focus: string;
};

export type ToolName =
  | "queryOrder"
  | "queryProduct"
  | "searchPolicy"
  | "createTicket"
  | "analyzeJD"
  | "generateCustomerReply";

export type ToolDefinition = {
  name: ToolName;
  scenario: string;
  description: string;
  inputExample: Record<string, unknown>;
  outputExample: Record<string, unknown>;
};

export type ToolRunStatus = "idle" | "success" | "failed";

export type ToolRunResult<TData = Record<string, unknown>> = {
  status: Exclude<ToolRunStatus, "idle">;
  tool: ToolName;
  input: Record<string, unknown>;
  data?: TData;
  error?: string;
  executedAt: string;
};

export type EvaluationMetric = {
  label: string;
  value: string;
  trend: string;
};

export type TestCase = {
  id: string;
  scenario: string;
  input: string;
  expectedTool: string;
  result: "pass" | "review";
  latency: string;
};
