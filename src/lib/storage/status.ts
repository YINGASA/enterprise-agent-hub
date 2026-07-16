export type StorageMode = "local" | "server" | "degraded";

export type PublicStorageStatus = {
  configured: boolean;
  healthy: boolean;
  storageMode: StorageMode;
  databaseType: "postgresql";
};

const LOCAL_STATUS: PublicStorageStatus = {
  configured: false,
  healthy: false,
  storageMode: "local",
  databaseType: "postgresql",
};

let cachedStatus: PublicStorageStatus | null = null;
let pendingStatus: Promise<PublicStorageStatus> | null = null;

function isStatus(value: unknown): value is PublicStorageStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.configured === "boolean"
    && typeof item.healthy === "boolean"
    && (item.storageMode === "local" || item.storageMode === "server" || item.storageMode === "degraded")
    && item.databaseType === "postgresql";
}

/**
 * Reads only the public, aggregate storage status. A failed status request is
 * treated as degraded so callers never silently write to localStorage while a
 * configured server may be unavailable.
 */
export async function getClientStorageStatus(force = false): Promise<PublicStorageStatus> {
  if (!force && cachedStatus && cachedStatus.storageMode !== "degraded") return cachedStatus;
  if (pendingStatus) return pendingStatus;
  pendingStatus = (async () => {
    try {
      const response = await fetch("/api/storage/status", { method: "GET", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("storage_status_unavailable");
      const payload = await response.json() as unknown;
      if (!isStatus(payload)) throw new Error("storage_status_invalid");
      cachedStatus = payload;
      return payload;
    } catch {
      const degraded: PublicStorageStatus = { ...LOCAL_STATUS, configured: true, storageMode: "degraded" };
      cachedStatus = degraded;
      return degraded;
    } finally {
      pendingStatus = null;
    }
  })();
  return pendingStatus;
}

export function clearClientStorageStatusCache() {
  cachedStatus = null;
  pendingStatus = null;
}

export function localStorageStatus(): PublicStorageStatus {
  return { ...LOCAL_STATUS };
}
