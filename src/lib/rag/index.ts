import type { KnowledgeChunk, KnowledgeDocument, RagAnswer, RetrievedChunk } from "@/types";

const DOMAIN_KEYWORDS = [
  "报销",
  "差旅",
  "发票",
  "行程单",
  "付款凭证",
  "材料",
  "客户拜访",
  "年假",
  "请假",
  "病假",
  "审批",
  "信息安全",
  "客户数据",
  "脱敏",
  "权限",
  "退货",
  "售后",
  "签收",
  "拆封",
  "质量问题",
  "优惠券",
  "订单",
  "发货",
  "AI",
  "RAG",
  "Agent",
  "Router",
  "Tool Calling",
  "结构化输出",
  "TypeScript",
  "Next.js",
  "评测",
  "招聘",
  "岗位",
  "简历",
];

const STOP_WORDS = new Set([
  "什么",
  "怎么",
  "需要",
  "可以",
  "是否",
  "一个",
  "这个",
  "那个",
  "公司",
  "企业",
  "请问",
  "规则",
  "制度",
  "说明",
  "相关",
]);

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[，。！？、；：,.!?;:()（）【】\[\]"'“”‘’]/g, " ");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sliceLongText(text: string, maxLength = 140) {
  const slices: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxLength) {
    const current = remaining.slice(0, maxLength);
    const breakIndex = Math.max(current.lastIndexOf("。"), current.lastIndexOf("；"), current.lastIndexOf("，"));
    const end = breakIndex > 40 ? breakIndex + 1 : maxLength;
    slices.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }

  if (remaining) {
    slices.push(remaining);
  }

  return slices;
}

export function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const latinTokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  const domainMatches = DOMAIN_KEYWORDS.filter((keyword) => normalized.includes(keyword.toLowerCase()));
  const chineseMatches = Array.from(text.matchAll(/[\u4e00-\u9fa5]{2,8}/g))
    .map((match) => match[0])
    .flatMap((token) => {
      if (token.length <= 4) {
        return [token];
      }
      const grams: string[] = [];
      for (let index = 0; index <= token.length - 2; index += 1) {
        grams.push(token.slice(index, index + 2));
      }
      return grams;
    })
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  return unique([...domainMatches, ...latinTokens, ...chineseMatches]).slice(0, 24);
}

export function splitDocument(document: KnowledgeDocument): KnowledgeChunk[] {
  const paragraphs = document.content
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => sliceLongText(paragraph));

  return paragraphs.map((content, index) => ({
    id: `${document.id}-chunk-${index + 1}`,
    documentId: document.id,
    sourceTitle: document.title,
    category: document.category,
    chunkIndex: index + 1,
    content,
    keywords: extractKeywords(`${document.title} ${document.category} ${content}`),
  }));
}

export function retrieveChunks(query: string, chunks: KnowledgeChunk[], topK = 3): RetrievedChunk[] {
  const queryKeywords = extractKeywords(query);

  if (!query.trim() || queryKeywords.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => {
      const titleKeywords = extractKeywords(`${chunk.sourceTitle} ${chunk.category}`);
      const matchedKeywords = queryKeywords.filter((keyword) => {
        const normalizedKeyword = keyword.toLowerCase();
        return (
          chunk.keywords.some((chunkKeyword) => chunkKeyword.toLowerCase() === normalizedKeyword) ||
          chunk.content.toLowerCase().includes(normalizedKeyword) ||
          chunk.sourceTitle.toLowerCase().includes(normalizedKeyword)
        );
      });

      const titleHits = matchedKeywords.filter((keyword) => titleKeywords.includes(keyword)).length;
      const categoryHits = matchedKeywords.filter((keyword) => chunk.category.toLowerCase().includes(keyword.toLowerCase())).length;
      const score = matchedKeywords.length * 2 + titleHits * 2 + categoryHits;

      return {
        chunk,
        score,
        matchedKeywords,
      } satisfies RetrievedChunk;
    })
    .filter((item) => item.score >= 2)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

function buildSources(retrievedChunks: RetrievedChunk[]): RagAnswer["sources"] {
  const sourceMap = new Map<string, RagAnswer["sources"][number]>();

  for (const item of retrievedChunks) {
    const existing = sourceMap.get(item.chunk.documentId);
    if (existing) {
      existing.chunkIndexes = unique([...existing.chunkIndexes.map(String), String(item.chunk.chunkIndex)]).map(Number);
      continue;
    }

    sourceMap.set(item.chunk.documentId, {
      documentId: item.chunk.documentId,
      title: item.chunk.sourceTitle,
      category: item.chunk.category,
      chunkIndexes: [item.chunk.chunkIndex],
    });
  }

  return Array.from(sourceMap.values());
}

export function generateMockRagAnswer(question: string, retrievedChunks: RetrievedChunk[]): RagAnswer {
  const createdAt = new Date().toISOString();

  if (retrievedChunks.length === 0) {
    return {
      question,
      answer: "根据当前知识库资料，我还不能确定这个问题的答案，需要补充相关文档或更明确的问题描述。",
      retrievedChunks: [],
      sources: [],
      mode: "mock-rag",
      createdAt,
    };
  }

  const evidence = retrievedChunks
    .slice(0, 2)
    .map((item) => item.chunk.content)
    .join(" ");

  return {
    question,
    answer: `根据知识库资料，${evidence} 以上为 mock RAG 根据关键词检索生成的回答，后续可替换为真实 LLM 生成。`,
    retrievedChunks,
    sources: buildSources(retrievedChunks),
    mode: "mock-rag",
    createdAt,
  };
}

export function runMockRagPipeline(question: string, documents: KnowledgeDocument[], topK = 3): RagAnswer {
  const chunks = documents.flatMap((document) => splitDocument(document));
  const retrievedChunks = retrieveChunks(question, chunks, topK);
  return generateMockRagAnswer(question, retrievedChunks);
}
