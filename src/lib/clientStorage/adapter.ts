import { emptyDiagnostics, type ClientStorageEnvelope, type ClientStorageListOptions, type ClientStorageResult } from "@/lib/clientStorage/schema";

function storage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function safeErrorType(error: unknown) {
  return error instanceof DOMException && error.name === "QuotaExceededError" ? "quota_exceeded" : "storage_write_failed";
}

function normalize<T>(values: unknown[], options: ClientStorageListOptions<T>) {
  const data: T[] = [];
  let filteredRecords = 0;
  for (const value of values) {
    const item = options.sanitize(value);
    if (item) data.push(item);
    else filteredRecords += 1;
  }
  return { data: data.slice(0, options.maxItems), filteredRecords: filteredRecords + Math.max(0, data.length - options.maxItems) };
}

export function readClientStorageList<T>(options: ClientStorageListOptions<T>): ClientStorageResult<T> {
  const diagnostics = emptyDiagnostics();
  const target = storage();
  if (!target) return { ok: true, data: [], diagnostics: { ...diagnostics, storageUnavailable: true, lastErrorType: "storage_unavailable" } };
  try {
    const raw = target.getItem(options.key);
    if (!raw) return { ok: true, data: [], diagnostics };
    const parsed = JSON.parse(raw) as unknown;
    const legacyArray = Array.isArray(parsed) ? parsed : undefined;
    const envelope = !legacyArray && parsed && typeof parsed === "object" ? parsed as Partial<ClientStorageEnvelope<unknown>> : undefined;
    const values = legacyArray ?? (Array.isArray(envelope?.data) ? envelope.data : null);
    if (!values) return { ok: false, data: [], diagnostics: { ...diagnostics, corruptedDataRecovered: true, lastErrorType: "corrupted_data" }, error: "本地数据格式损坏，已安全恢复为空状态。" };
    const normalized = normalize(values, options);
    const migrated = Boolean(legacyArray || envelope?.version !== options.version);
    const result = { ok: true, data: normalized.data, diagnostics: { ...diagnostics, migrated, filteredRecords: normalized.filteredRecords } };
    if (migrated || normalized.filteredRecords) writeClientStorageList(options, normalized.data);
    return result;
  } catch {
    return { ok: false, data: [], diagnostics: { ...diagnostics, corruptedDataRecovered: true, lastErrorType: "corrupted_data" }, error: "本地数据无法读取，已安全恢复为空状态。" };
  }
}

export function writeClientStorageList<T>(options: ClientStorageListOptions<T>, values: T[]): ClientStorageResult<T> {
  const diagnostics = emptyDiagnostics();
  const target = storage();
  const data = values.slice(0, options.maxItems);
  if (!target) return { ok: false, data, diagnostics: { ...diagnostics, storageUnavailable: true, lastErrorType: "storage_unavailable" }, error: "本地存储不可用，本次数据仅保留在当前页面。" };
  try {
    const envelope: ClientStorageEnvelope<T> = { version: options.version, data, updatedAt: new Date().toISOString() };
    target.setItem(options.key, JSON.stringify(envelope));
    return { ok: true, data, diagnostics: { ...diagnostics, filteredRecords: Math.max(0, values.length - data.length) } };
  } catch (error) {
    const type = safeErrorType(error);
    return { ok: false, data, diagnostics: { ...diagnostics, quotaExceeded: type === "quota_exceeded", lastErrorType: type }, error: type === "quota_exceeded" ? "本地存储空间不足，未能保存本次更新。" : "本地存储写入失败。" };
  }
}

export function clearClientStorageList<T>(options: ClientStorageListOptions<T>) {
  return writeClientStorageList(options, []);
}
