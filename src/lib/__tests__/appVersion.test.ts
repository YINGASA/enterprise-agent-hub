import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { appVersion, appVersionLabel, buildCommit, releaseChannel, toSafeBuildCommit } from "@/lib/appVersion";

describe("app version metadata", () => {
  it("matches the package version without including sensitive configuration", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")) as { version: string };
    expect(appVersion).toBe(packageJson.version);
    expect(appVersionLabel).toBe("Enterprise Agent Hub V1.12.5");
    expect(JSON.stringify({ appVersion, appVersionLabel, buildCommit, releaseChannel })).not.toMatch(/api[_-]?key|provider|baseurl|token/i);
  });

  it("uses only a safe short commit format when one is available", () => {
    expect(toSafeBuildCommit(undefined)).toBeUndefined();
    expect(toSafeBuildCommit("not-a-commit")).toBeUndefined();
    expect(toSafeBuildCommit("A1B2C3D4E5F6")).toBe("a1b2c3d");
    expect(buildCommit === undefined || /^[a-f0-9]{7}$/i.test(buildCommit)).toBe(true);
    expect(["production", "development"]).toContain(releaseChannel);
  });
});
