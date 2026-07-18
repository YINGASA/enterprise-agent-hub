const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const knowledgeMetadataLimits = {
  maximumDepth: 4,
  maximumKeys: 32,
  maximumArrayItems: 24,
  maximumStringChars: 500,
  maximumSerializedChars: 4_000,
} as const;

export type SafeMetadataValue = string | number | boolean | null | SafeMetadataValue[] | { [key: string]: SafeMetadataValue };

function sanitizeValue(value: unknown, depth: number, keyCount: { value: number }): SafeMetadataValue | undefined {
  if (depth > knowledgeMetadataLimits.maximumDepth) return undefined;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return value.length <= knowledgeMetadataLimits.maximumStringChars ? value : undefined;
  if (Array.isArray(value)) {
    if (value.length > knowledgeMetadataLimits.maximumArrayItems) return undefined;
    const items: SafeMetadataValue[] = [];
    for (const item of value) {
      const safe = sanitizeValue(item, depth + 1, keyCount);
      if (safe === undefined) return undefined;
      items.push(safe);
    }
    return items;
  }
  if (!value || typeof value !== "object") return undefined;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  const result: Record<string, SafeMetadataValue> = {};
  for (const [key, item] of entries) {
    if (!key || key.length > 80 || FORBIDDEN_KEYS.has(key)) return undefined;
    keyCount.value += 1;
    if (keyCount.value > knowledgeMetadataLimits.maximumKeys) return undefined;
    const safe = sanitizeValue(item, depth + 1, keyCount);
    if (safe === undefined) return undefined;
    result[key] = safe;
  }
  return result;
}

/**
 * Returns a detached JSON-only object. Prototype-pollution keys, non-finite
 * values, class instances and over-sized structures are rejected atomically.
 */
export function sanitizeKnowledgeMetadata(value: unknown): Record<string, SafeMetadataValue> | null {
  if (value === undefined) return {};
  const safe = sanitizeValue(value, 0, { value: 0 });
  if (!safe || Array.isArray(safe) || typeof safe !== "object") return null;
  try {
    if (JSON.stringify(safe).length > knowledgeMetadataLimits.maximumSerializedChars) return null;
  } catch {
    return null;
  }
  return safe as Record<string, SafeMetadataValue>;
}

/** Shared alias used by request, stream and persistence sanitizers. */
export const sanitizeSafeMetadata = sanitizeKnowledgeMetadata;
