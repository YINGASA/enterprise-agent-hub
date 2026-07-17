export type StorageMode = "local" | "server" | "degraded";

export type ServerStorageConfiguration = {
  storageEnabled: boolean;
  databaseConfigured: boolean;
  sessionSecretConfigured: boolean;
};

type StorageEnvironment = Partial<Record<"DATABASE_URL" | "SERVER_STORAGE_ENABLED" | "STORAGE_SESSION_SECRET", string>>;

function isEnabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

/**
 * Reads only whether storage settings exist. Secret values and connection strings
 * are deliberately excluded from the returned object so callers cannot log them.
 */
export function getServerStorageConfiguration(environment: StorageEnvironment = process.env as StorageEnvironment): ServerStorageConfiguration {
  return {
    storageEnabled: isEnabled(environment.SERVER_STORAGE_ENABLED?.trim()),
    databaseConfigured: Boolean(environment.DATABASE_URL?.trim()),
    sessionSecretConfigured: Boolean(environment.STORAGE_SESSION_SECRET?.trim()),
  };
}

export function resolveStorageMode(input: ServerStorageConfiguration & { databaseHealthy: boolean }): StorageMode {
  if (!input.storageEnabled) return "local";
  if (!input.databaseConfigured || !input.sessionSecretConfigured || !input.databaseHealthy) return "degraded";
  return "server";
}
