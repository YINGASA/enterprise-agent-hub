import type { AgentScenario, KnowledgeChunk, KnowledgeDocument, KnowledgePackId, RagAnswer, RetrievedChunk } from "@/types";

type RagPipelineOptions = { topK?: number; packId?: KnowledgePackId; scenario?: AgentScenario | "ai-engineering"; };

const DOMAIN_KEYWORDS = ["报销","差旅","发票","行程单","付款凭证","材料","客户拜访","年假","请假","病假","加班","调休","审批","合同","采购","项目立项","工单","SLA","入职","离职","信息安全","客户数据","脱敏","权限","退货","退款","售后","签收","拆封","七天无理由","7天无理由","质量问题","换货","物流","投诉","客服","话术","尺码","库存","缺货","AI","大模型","RAG","Agent","Router","Tool Calling","工具调用","结构化输出","JSON","fallback","评测","可观测性","API Key","Prompt","向量数据库","Embedding","招聘","求职","岗位","JD","简历","匹配","面试","实习生","项目经历","关键词"];

const SYNONYMS: Record<string, string[]> = {
  "退货": ["退款", "售后", "七天无理由", "7天无理由", "退换货"],
  "退款": ["退货", "售后", "到账", "原路退回"],
  "售后": ["退货", "退款", "换货", "质量问题", "投诉"],
  "请假": ["年假", "病假", "事假", "调休", "休假"],
  "年假": ["休假", "请假", "带薪年假"],
  "调休": ["加班", "请假", "休假"],
  "JD": ["岗位", "职位", "招聘", "简历", "匹配"],
  "岗位": ["JD", "职位", "招聘", "求职", "简历"],
  "简历": ["JD", "岗位", "匹配", "项目经历", "关键词"],
  "匹配": ["JD", "岗位", "简历", "评分"],
  "工具调用": ["Tool Calling", "Agent", "参数", "工具"],
  "Agent": ["Router", "工具调用", "Tool Calling", "Trace"],
  "RAG": ["知识库", "检索", "引用", "召回", "chunk"],
  "结构化输出": ["JSON", "Schema", "解析", "repair"],
  "fallback": ["兜底", "降级", "异常", "失败"],
};

const STOP_WORDS = new Set(["什么", "怎么", "需要", "可以", "是否", "一个", "这个", "那个", "请问", "说明", "相关", "如果", "应该", "如何", "有没有", "帮我"]);

const scenarioPackMap: Partial<Record<AgentScenario | "ai-engineering", KnowledgePackId>> = { enterprise: "enterprise-policy", ecommerce: "ecommerce-support", recruitment: "recruitment-career", "ai-engineering": "ai-engineering" };

function normalizeText(text: string) { return text.toLowerCase().replace(/[，。！？、；：.!?;:()（）【】[\]"'“”‘’`]/g, " "); }
function unique(values: string[]) { return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))); }

function sliceLongText(text: string, maxLength = 180) {
  const slices: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maxLength) {
    const current = remaining.slice(0, maxLength);
    const breakIndex = Math.max(current.lastIndexOf("。"), current.lastIndexOf("；"), current.lastIndexOf("，"));
    const end = breakIndex > 60 ? breakIndex + 1 : maxLength;
    slices.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) slices.push(remaining);
  return slices;
}

function expandSynonyms(keywords: string[]) {
  const expanded = [...keywords];
  for (const keyword of keywords) {
    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (keyword.toLowerCase() === key.toLowerCase() || values.some((value) => value.toLowerCase() === keyword.toLowerCase())) expanded.push(key, ...values);
    }
  }
  return unique(expanded);
}

export function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const domainMatches = DOMAIN_KEYWORDS.filter((keyword) => normalized.includes(keyword.toLowerCase()));
  const latinTokens = normalized.split(/\s+/).map((token) => token.trim()).filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  const chineseMatches = Array.from(text.matchAll(/[\u4e00-\u9fa5]{2,10}/g)).map((match) => match[0]).flatMap((token) => {
    if (token.length <= 4) return [token];
    const grams: string[] = [];
    for (let index = 0; index <= token.length - 2; index += 1) grams.push(token.slice(index, index + 2));
    return grams;
  }).filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return expandSynonyms(unique([...domainMatches, ...latinTokens, ...chineseMatches])).slice(0, 40);
}

export function splitDocument(document: KnowledgeDocument): KnowledgeChunk[] {
  const paragraphs = document.content.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).flatMap((paragraph) => sliceLongText(paragraph));
  return paragraphs.map((content, index) => ({
    id: document.id + "-chunk-" + (index + 1),
    documentId: document.id,
    packId: document.packId,
    sourceTitle: document.title,
    category: document.category,
    tags: document.tags ?? [],
    sourceType: document.sourceType ?? (document.isDefault === false ? "user_paste" : "default"),
    originalFileName: document.originalFileName,
    chunkIndex: index + 1,
    content,
    keywords: extractKeywords(document.title + " " + document.category + " " + (document.tags ?? []).join(" ") + " " + (document.summary ?? "") + " " + content),
  }));
}

function includesNormalized(text: string, keyword: string) { return text.toLowerCase().includes(keyword.toLowerCase()); }

export function retrieveChunks(query: string, chunks: KnowledgeChunk[], topK = 3, preferredPackId?: KnowledgePackId): RetrievedChunk[] {
  const queryKeywords = extractKeywords(query);
  if (!query.trim() || queryKeywords.length === 0) return [];
  return chunks.map((chunk) => {
    const titleText = chunk.sourceTitle;
    const categoryText = chunk.category;
    const tagsText = (chunk.tags ?? []).join(" ");
    const matchedKeywords = queryKeywords.filter((keyword) => chunk.keywords.some((chunkKeyword) => chunkKeyword.toLowerCase() === keyword.toLowerCase()) || includesNormalized(chunk.content, keyword) || includesNormalized(titleText, keyword) || includesNormalized(categoryText, keyword) || includesNormalized(tagsText, keyword));
    const titleHits = matchedKeywords.filter((keyword) => includesNormalized(titleText, keyword)).length;
    const categoryHits = matchedKeywords.filter((keyword) => includesNormalized(categoryText, keyword)).length;
    const tagHits = matchedKeywords.filter((keyword) => includesNormalized(tagsText, keyword)).length;
    const packBoost = preferredPackId && chunk.packId === preferredPackId ? 3 : 0;
    const userSourceBoost = chunk.sourceType === "user_upload" || chunk.sourceType === "user_paste" ? 4 : 0;
    const score = matchedKeywords.length * 2 + titleHits * 3 + categoryHits * 2 + tagHits * 2 + packBoost + userSourceBoost;
    const scoreReason = [matchedKeywords.length ? "keyword hits " + matchedKeywords.length : "no keyword hit", titleHits ? "title hits " + titleHits : "no title hit", categoryHits ? "category hits " + categoryHits : "no category hit", tagHits ? "tag hits " + tagHits : "no tag hit", packBoost ? "pack boost " + preferredPackId : "no pack boost", userSourceBoost ? "user imported document boost" : "default knowledge base"];
    return { chunk, score, matchedKeywords: unique(matchedKeywords), scoreReason } satisfies RetrievedChunk;
  }).filter((item) => item.score >= 2).sort((left, right) => right.score - left.score).slice(0, topK);
}

function buildSources(retrievedChunks: RetrievedChunk[]): RagAnswer["sources"] {
  const sourceMap = new Map<string, RagAnswer["sources"][number]>();
  for (const item of retrievedChunks) {
    const existing = sourceMap.get(item.chunk.documentId);
    if (existing) { existing.chunkIndexes = unique([...existing.chunkIndexes.map(String), String(item.chunk.chunkIndex)]).map(Number); continue; }
    sourceMap.set(item.chunk.documentId, { documentId: item.chunk.documentId, title: item.chunk.sourceTitle, category: item.chunk.category, packId: item.chunk.packId, sourceType: item.chunk.sourceType, chunkIndexes: [item.chunk.chunkIndex] });
  }
  return Array.from(sourceMap.values());
}

export function generateMockRagAnswer(question: string, retrievedChunks: RetrievedChunk[]): RagAnswer {
  const createdAt = new Date().toISOString();
  if (retrievedChunks.length === 0) return { question, answer: "根据当前知识库资料，我还不能确定这个问题的答案。建议补充相关文档、业务规则或可调用工具后再回答。", retrievedChunks: [], sources: [], mode: "mock-rag", createdAt };
  const evidence = retrievedChunks.slice(0, 2).map((item) => item.chunk.content).join(" ");
  return { question, answer: "根据知识库资料，" + evidence + " 以上为 mock RAG 基于关键词检索生成的回答，后续可替换为向量检索与真实 LLM 生成。", retrievedChunks, sources: buildSources(retrievedChunks), mode: "mock-rag", createdAt };
}

export function runMockRagPipeline(question: string, documents: KnowledgeDocument[], topKOrOptions: number | RagPipelineOptions = 3): RagAnswer {
  const options: RagPipelineOptions = typeof topKOrOptions === "number" ? { topK: topKOrOptions } : topKOrOptions;
  const preferredPackId = options.packId ?? (options.scenario ? scenarioPackMap[options.scenario] : undefined);
  const chunks = documents.flatMap((document) => splitDocument(document));
  const retrievedChunks = retrieveChunks(question, chunks, options.topK ?? 3, preferredPackId);
  return generateMockRagAnswer(question, retrievedChunks);
}
