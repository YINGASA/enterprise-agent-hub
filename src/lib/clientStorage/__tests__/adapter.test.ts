import { afterEach, describe, expect, it } from "vitest";
import { clearClientStorageList, readClientStorageList, writeClientStorageList, type ClientStorageListOptions } from "@/lib/clientStorage";

type Item = { id: string; createdAt: string };
const options: ClientStorageListOptions<Item> = {
  key: "test:storage",
  version: 1,
  maxItems: 2,
  sanitize: (value) => value && typeof value === "object" && typeof (value as Item).id === "string" && typeof (value as Item).createdAt === "string" ? value as Item : null,
};

function installStorage(throwOnSet = false) {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { if (throwOnSet) throw new DOMException("quota", "QuotaExceededError"); data.set(key, value); }, removeItem: (key: string) => data.delete(key) } } });
  return data;
}

afterEach(() => Reflect.deleteProperty(globalThis, "window"));

describe("client storage adapter", () => {
  it("migrates legacy arrays and filters invalid records", () => {
    const storage = installStorage();
    storage.set(options.key, JSON.stringify([{ id: "one", createdAt: "2026-01-01" }, { invalid: true }]));
    const result = readClientStorageList(options);
    expect(result).toMatchObject({ ok: true, data: [{ id: "one" }], diagnostics: { migrated: true, filteredRecords: 1 } });
    expect(JSON.parse(storage.get(options.key) ?? "{}")).toMatchObject({ version: 1, data: [{ id: "one" }] });
  });

  it("recovers from corrupt JSON, trims capacity, and clears safely", () => {
    const storage = installStorage();
    storage.set(options.key, "{");
    expect(readClientStorageList(options).diagnostics.corruptedDataRecovered).toBe(true);
    expect(writeClientStorageList(options, [{ id: "one", createdAt: "a" }, { id: "two", createdAt: "b" }, { id: "three", createdAt: "c" }]).data).toHaveLength(2);
    expect(clearClientStorageList(options)).toMatchObject({ ok: true, data: [] });
  });

  it("degrades safely when local storage is unavailable or quota limited", () => {
    expect(readClientStorageList(options).diagnostics.storageUnavailable).toBe(true);
    installStorage(true);
    expect(writeClientStorageList(options, [{ id: "one", createdAt: "a" }])).toMatchObject({ ok: false, diagnostics: { quotaExceeded: true } });
  });
});
