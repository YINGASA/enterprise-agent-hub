type OpenAiSseData = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

export type OpenAiSseEvent = { type: "delta"; content: string } | { type: "done" };

export function createOpenAiSseParser(onEvent: (event: OpenAiSseEvent) => void) {
  let buffer = "";

  const parseEvent = (rawEvent: string) => {
    const data = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data) return;
    if (data === "[DONE]") {
      onEvent({ type: "done" });
      return;
    }
    try {
      const parsed = JSON.parse(data) as OpenAiSseData;
      const content = parsed.choices?.[0]?.delta?.content;
      if (typeof content === "string" && content) onEvent({ type: "delta", content });
    } catch {
      // Ignore malformed upstream events. The caller validates the complete result.
    }
  };

  const drain = (flush: boolean) => {
    const pattern = /\r?\n\r?\n/;
    while (true) {
      const match = pattern.exec(buffer);
      if (!match) break;
      parseEvent(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
    }
    if (flush && buffer.trim()) {
      parseEvent(buffer);
      buffer = "";
    }
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      drain(false);
    },
    finish() {
      drain(true);
    },
  };
}

export function extractJsonStringValuePrefix(json: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keyIndex = json.search(new RegExp(`"${escapedKey}"\\s*:`));
  if (keyIndex < 0) return "";
  const colonIndex = json.indexOf(":", keyIndex);
  let index = colonIndex + 1;
  while (/\s/.test(json[index] ?? "")) index += 1;
  if (json[index] !== '"') return "";
  index += 1;

  let decoded = "";
  while (index < json.length) {
    const char = json[index];
    if (char === '"') return decoded;
    if (char !== "\\") {
      decoded += char;
      index += 1;
      continue;
    }

    const escape = json[index + 1];
    if (!escape) break;
    const escapes: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
    if (escape === "u") {
      const code = json.slice(index + 2, index + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(code)) break;
      decoded += String.fromCharCode(Number.parseInt(code, 16));
      index += 6;
      continue;
    }
    if (!(escape in escapes)) break;
    decoded += escapes[escape];
    index += 2;
  }
  return decoded;
}
