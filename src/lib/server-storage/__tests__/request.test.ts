import { describe, expect, it } from "vitest";
import { StorageApiError } from "@/lib/server-storage/errors";
import { readBoundedTextBody, requireSameOrigin } from "@/lib/server-storage/request";

describe("same-origin storage writes", () => {
  it("accepts an exact same-origin request", () => {
    const originRequest = new Request("https://hub.example/api/storage/conversations", { method: "POST", headers: { origin: "https://hub.example" } });
    const fetchMetadataRequest = new Request("https://hub.example/api/agent/stream", { method: "POST", headers: { "sec-fetch-site": "same-origin" } });
    const refererRequest = new Request("https://hub.example/api/agent", { method: "POST", headers: { referer: "https://hub.example/chat" } });
    const proxyMetadataRequest = new Request("https://hub.example/api/agent", { method: "POST", headers: { "sec-fetch-site": "same-site", referer: "https://hub.example/chat" } });
    const publicHostRequest = new Request("http://localhost:3100/api/agent", { method: "POST", headers: { host: "127.0.0.1:3100", referer: "http://127.0.0.1:3100/chat" } });
    const tlsProxyRequest = new Request("http://internal:3100/api/agent", { method: "POST", headers: { host: "hub.example", "x-forwarded-proto": "https", referer: "https://hub.example/chat" } });
    for (const request of [originRequest, fetchMetadataRequest, refererRequest, proxyMetadataRequest, publicHostRequest, tlsProxyRequest]) {
      expect(() => requireSameOrigin(request)).not.toThrow();
    }
  });

  it("rejects missing, cross-origin, same-site, and origin-with-path requests", () => {
    const missing = new Request("https://hub.example/api/storage/conversations", { method: "POST" });
    const crossOrigin = new Request("https://hub.example/api/storage/conversations", { method: "POST", headers: { origin: "https://attacker.example" } });
    const crossSiteMetadata = new Request("https://hub.example/api/agent", { method: "POST", headers: { "sec-fetch-site": "cross-site", referer: "https://attacker.example/page" } });
    const sameSiteMetadata = new Request("https://hub.example/api/agent", { method: "POST", headers: { "sec-fetch-site": "same-site" } });
    const withPath = new Request("https://hub.example/api/storage/conversations", { method: "POST", headers: { origin: "https://hub.example/path" } });
    for (const request of [missing, crossOrigin, crossSiteMetadata, sameSiteMetadata, withPath]) {
      expect(() => requireSameOrigin(request)).toThrowError(StorageApiError);
      try {
        requireSameOrigin(request);
      } catch (error) {
        expect(error).toMatchObject({ code: "forbidden_origin", status: 403 });
      }
    }
  });
});

describe("bounded request bodies", () => {
  it("cancels a streamed body as soon as the character limit is exceeded", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("12345678"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://hub.example/api/storage/migration", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readBoundedTextBody(request, 4)).rejects.toMatchObject({ code: "payload_too_large", status: 413 });
    expect(cancelled).toBe(true);
  });

  it("treats Content-Length as bytes without rejecting valid CJK text", async () => {
    const raw = JSON.stringify({ value: "中文内容" });
    const bytes = new TextEncoder().encode(raw).byteLength;
    const request = new Request("https://hub.example/api/storage/knowledge", {
      method: "POST",
      headers: { "content-length": String(bytes) },
      body: raw,
    });
    await expect(readBoundedTextBody(request, raw.length)).resolves.toBe(raw);
  });
});
