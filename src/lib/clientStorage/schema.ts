export type ClientStorageDiagnostics = {
  migrated: boolean;
  filteredRecords: number;
  storageUnavailable: boolean;
  quotaExceeded: boolean;
  corruptedDataRecovered: boolean;
  lastErrorType?: "storage_unavailable" | "corrupted_data" | "quota_exceeded" | "storage_write_failed";
};

export type ClientStorageResult<T> = {
  ok: boolean;
  data: T[];
  diagnostics: ClientStorageDiagnostics;
  error?: string;
};

export type ClientStorageEnvelope<T> = { version: number; data: T[]; updatedAt: string };

export type ClientStorageListOptions<T> = {
  key: string;
  version: number;
  maxItems: number;
  sanitize: (value: unknown) => T | null;
};

export function emptyDiagnostics(): ClientStorageDiagnostics {
  return { migrated: false, filteredRecords: 0, storageUnavailable: false, quotaExceeded: false, corruptedDataRecovered: false };
}
