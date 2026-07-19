import { createServer, type Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import type { Duplex } from "node:stream";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenAICompatibleChat, streamOpenAICompatibleChat } from "@/lib/llm";

const cleanupTasks: Array<() => Promise<void>> = [];
const require = createRequire(import.meta.url);

function registerServer(server: Server, upgradedSockets: Set<Duplex> = new Set()) {
  cleanupTasks.push(async () => {
    for (const socket of upgradedSockets) socket.destroy();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
}

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  registerServer(server);
  return server.address() as AddressInfo;
}

function configureClient(baseUrl: string, timeoutMs = 1_000) {
  vi.stubEnv("AI_API_KEY", "node20-test-key-not-real");
  vi.stubEnv("AI_BASE_URL", baseUrl);
  vi.stubEnv("AI_MODEL", "node20-test-model");
  vi.stubEnv("AI_PROVIDER", "openai-compatible");
  vi.stubEnv("AI_REQUEST_TIMEOUT_MS", String(timeoutMs));
  vi.stubEnv("HTTPS_PROXY", "");
  vi.stubEnv("HTTP_PROXY", "");
  vi.stubEnv("ALL_PROXY", "");
}

function successfulCompletion(answer = "Node 20 可用") {
  return JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ answer, scenario: "general", intent: "general_chat" }) } }],
    model: "node20-test-model",
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for local test transport cleanup.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const cleanup of cleanupTasks.splice(0).reverse()) await cleanup();
});

describe("Node 20 Real API compatibility", () => {
  it("runs on the pinned Node release and loads the maintained Node 20 Undici line", async () => {
    expect(process.version).toBe("v20.19.5");
    const packageMetadata = require("undici/package.json") as { version?: string; engines?: { node?: string } };
    expect(packageMetadata).toMatchObject({ version: "7.28.0", engines: { node: ">=20.18.1" } });
    const undici = await import("undici");
    expect(typeof undici.fetch).toBe("function");
    const proxyAgent = new undici.ProxyAgent("http://127.0.0.1:9");
    await proxyAgent.close();
  });

  it("handles a complete OpenAI-compatible response through a local HTTP service", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(successfulCompletion());
    });
    const address = await listen(server);
    configureClient(`http://127.0.0.1:${address.port}/v1`);

    const result = await callOpenAICompatibleChat([{ role: "user", content: "local test" }], { responseFormat: "json_object" });

    expect(result).toMatchObject({ httpStatus: 200, errorType: undefined, parsedJson: { answer: "Node 20 可用" } });
  });

  it("streams ordered SSE deltas through the Node 20 HTTP client", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      const first = JSON.stringify({ choices: [{ delta: { content: '{"answer":"Node 20' } }] });
      const second = JSON.stringify({ choices: [{ delta: { content: ' 流式可用","scenario":"general","intent":"general_chat"}' } }] });
      response.write(`data: ${first}\n\n`);
      setTimeout(() => response.end(`data: ${second}\n\ndata: [DONE]\n\n`), 10);
    });
    const address = await listen(server);
    configureClient(`http://127.0.0.1:${address.port}/v1`);
    const deltas: string[] = [];

    const result = await streamOpenAICompatibleChat(
      [{ role: "user", content: "local stream test" }],
      { responseFormat: "json_object" },
      (delta) => deltas.push(delta),
    );

    expect(deltas.join("")).toBe("Node 20 流式可用");
    expect(result).toMatchObject({ streamingUsed: true, streamFallback: false, deltaCount: 2, parsedJson: { answer: "Node 20 流式可用" } });
  });

  it.each([401, 429, 500])("classifies upstream HTTP %s without exposing request data", async (status) => {
    const server = createServer((_request, response) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "safe-test-error" }));
    });
    const address = await listen(server);
    configureClient(`http://127.0.0.1:${address.port}/v1`);

    const result = await callOpenAICompatibleChat([{ role: "user", content: "private prompt marker" }]);

    expect(result).toMatchObject({ errorType: "http_error", httpStatus: status });
    expect(JSON.stringify({ errorType: result.errorType, httpStatus: result.httpStatus })).not.toContain("private prompt marker");
  });

  it("distinguishes an internal timeout from a caller abort", async () => {
    const server = createServer(() => undefined);
    const address = await listen(server);
    configureClient(`http://127.0.0.1:${address.port}/v1`, 30);

    const timedOut = await callOpenAICompatibleChat([{ role: "user", content: "timeout" }]);
    expect(timedOut.errorType).toBe("timeout_error");

    configureClient(`http://127.0.0.1:${address.port}/v1`, 1_000);
    const controller = new AbortController();
    const aborted = callOpenAICompatibleChat([{ role: "user", content: "abort" }], { signal: controller.signal });
    setTimeout(() => controller.abort(new DOMException("aborted", "AbortError")), 10);
    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
  });

  it("propagates a caller abort while consuming an SSE response", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"answer":"partial' } }] })}\n\n`);
    });
    const address = await listen(server);
    configureClient(`http://127.0.0.1:${address.port}/v1`, 1_000);
    const controller = new AbortController();
    const deltas: string[] = [];
    const result = streamOpenAICompatibleChat(
      [{ role: "user", content: "abort stream" }],
      { signal: controller.signal },
      (delta) => deltas.push(delta),
    );
    setTimeout(() => controller.abort(new DOMException("aborted", "AbortError")), 20);

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(deltas).toEqual(["partial"]);
  });

  it("classifies an SSE read deadline as a timeout without converting it to a caller abort", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"answer":"partial' } }] })}\n\n`);
    });
    const address = await listen(server);
    configureClient(`http://127.0.0.1:${address.port}/v1`, 30);
    const deltas: string[] = [];

    const result = await streamOpenAICompatibleChat(
      [{ role: "user", content: "timeout stream" }],
      {},
      (delta) => deltas.push(delta),
    );

    expect(result).toMatchObject({ errorType: "timeout_error", streamingUsed: true, streamFallback: false });
    expect(deltas).toEqual(["partial"]);
  });

  it("uses ProxyAgent on Node 20 and closes its tunnel after the response", async () => {
    const target = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(successfulCompletion("代理链路可用"));
    });
    const targetAddress = await listen(target);
    const proxySockets = new Set<Duplex>();
    const proxy = createServer();
    proxy.on("connect", (request, clientSocket, head) => {
      proxySockets.add(clientSocket);
      clientSocket.once("close", () => proxySockets.delete(clientSocket));
      const [host, portText] = (request.url ?? "").split(":");
      const upstream = connect(Number(portText), host, () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      });
      upstream.once("error", () => clientSocket.destroy());
      clientSocket.once("error", () => upstream.destroy());
    });
    await new Promise<void>((resolve, reject) => {
      proxy.once("error", reject);
      proxy.listen(0, "127.0.0.1", () => {
        proxy.off("error", reject);
        resolve();
      });
    });
    registerServer(proxy, proxySockets);
    const proxyAddress = proxy.address() as AddressInfo;
    configureClient(`http://127.0.0.1:${targetAddress.port}/v1`);
    vi.stubEnv("HTTP_PROXY", `http://127.0.0.1:${proxyAddress.port}`);

    const result = await callOpenAICompatibleChat([{ role: "user", content: "proxy test" }]);

    expect(result).toMatchObject({ parsedJson: { answer: "代理链路可用" }, hasProxy: true, proxyType: "HTTP_PROXY" });
    await waitFor(() => proxySockets.size === 0);
  });

  it("classifies malformed and unreachable upstream responses safely", async () => {
    const malformed = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("not-json");
    });
    const address = await listen(malformed);
    configureClient(`http://127.0.0.1:${address.port}/v1`);
    const malformedResult = await callOpenAICompatibleChat([{ role: "user", content: "malformed" }]);
    expect(malformedResult.errorType).toBe("invalid_response_shape");

    const unavailable = createServer();
    const unavailableAddress = await listen(unavailable);
    await cleanupTasks.pop()?.();
    configureClient(`http://127.0.0.1:${unavailableAddress.port}/v1`);
    const networkResult = await callOpenAICompatibleChat([{ role: "user", content: "network" }]);
    expect(networkResult.errorType).toBe("network_error");
  });
});
