export const appVersion = "2.0.0";

export const releaseChannel = process.env.NODE_ENV === "production" ? "production" : "development";

export function toSafeBuildCommit(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return /^[a-f0-9]{7,40}$/i.test(normalized) ? normalized.slice(0, 7).toLowerCase() : undefined;
}

export const buildCommit = toSafeBuildCommit(process.env.NEXT_PUBLIC_EAH_BUILD_COMMIT);

export const appVersionLabel = `Enterprise Agent Hub V${appVersion}`;
