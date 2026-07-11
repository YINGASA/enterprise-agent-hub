import { diagnoseKnowledgeChunks, assessKnowledgeDocument, type ChunkQualityDiagnostic, type KnowledgeQualityAssessment } from "@/lib/knowledge/quality";
import { splitDocument } from "@/lib/rag";
import type { KnowledgeChunk, KnowledgeDocument } from "@/types";

export type KnowledgeDerivedData = {
  cacheKey: string;
  chunks: KnowledgeChunk[];
  quality: KnowledgeQualityAssessment;
  chunkDiagnostics: ChunkQualityDiagnostic[];
  characterCount: number;
  fingerprint: string;
};

const derivedCache = new Map<string, KnowledgeDerivedData>();

function cacheKey(document: KnowledgeDocument) {
  return `${document.id}:${document.updatedAt}`;
}

function fingerprint(document: Pick<KnowledgeDocument, "title" | "content">) {
  const normalized = `${document.title}\n${document.content}`.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getKnowledgeDerived(document: KnowledgeDocument): KnowledgeDerivedData {
  const key = cacheKey(document);
  const cached = derivedCache.get(key);
  if (cached) return cached;

  for (const existingKey of derivedCache.keys()) {
    if (existingKey.startsWith(`${document.id}:`)) derivedCache.delete(existingKey);
  }

  const chunks = splitDocument(document);
  const derived: KnowledgeDerivedData = {
    cacheKey: key,
    chunks,
    quality: assessKnowledgeDocument(document, chunks),
    chunkDiagnostics: diagnoseKnowledgeChunks(chunks),
    characterCount: document.content.trim().length,
    fingerprint: fingerprint(document),
  };
  derivedCache.set(key, derived);
  return derived;
}

export function invalidateKnowledgeDerived(documentId: string) {
  for (const key of derivedCache.keys()) {
    if (key.startsWith(`${documentId}:`)) derivedCache.delete(key);
  }
}

export function clearKnowledgeDerivedCache() {
  derivedCache.clear();
}
