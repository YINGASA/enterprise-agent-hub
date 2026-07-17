import { StorageApiError } from "@/lib/server-storage/errors";

export async function readBoundedTextBody(request: Request, maximumCharacters: number): Promise<string> {
  const maximumBytes = maximumCharacters * 4;
  const suppliedLength = request.headers.get("content-length");
  if (suppliedLength !== null) {
    const announcedBytes = Number(suppliedLength);
    if (Number.isFinite(announcedBytes) && announcedBytes > maximumBytes) {
      throw new StorageApiError("payload_too_large", 413, "请求内容超过允许大小。", false);
    }
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  let charactersRead = 0;

  const cancel = async () => {
    try {
      await reader.cancel("payload_too_large");
    } catch {
      // The transport may already be closed. The size failure remains the
      // externally visible result and must not expose transport details.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maximumBytes) {
      await cancel();
      throw new StorageApiError("payload_too_large", 413, "请求内容超过允许大小。", false);
    }
    const decoded = decoder.decode(value, { stream: true });
    charactersRead += decoded.length;
    if (charactersRead > maximumCharacters) {
      await cancel();
      throw new StorageApiError("payload_too_large", 413, "请求内容超过允许大小。", false);
    }
    chunks.push(decoded);
  }

  const tail = decoder.decode();
  charactersRead += tail.length;
  if (charactersRead > maximumCharacters) {
    await cancel();
    throw new StorageApiError("payload_too_large", 413, "请求内容超过允许大小。", false);
  }
  chunks.push(tail);
  return chunks.join("");
}

function expectedRequestOrigin(request: Request, override?: string): string {
  if (override) return new URL(override).origin;

  const requestUrl = new URL(request.url);
  const host = request.headers.get("host")?.trim();
  if (!host || /[\s\/@,]/.test(host)) return requestUrl.origin;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? `${forwardedProto}:`
    : requestUrl.protocol;
  const publicUrl = new URL(`${protocol}//${host}`);
  return publicUrl.host === host ? publicUrl.origin : requestUrl.origin;
}

export function requireSameOrigin(request: Request, expectedOrigin?: string): void {
  const suppliedOrigin = request.headers.get("origin");
  let normalizedExpectedOrigin: string;
  try {
    normalizedExpectedOrigin = expectedRequestOrigin(request, expectedOrigin);
  } catch {
    throw new StorageApiError("forbidden_origin", 403, "写入请求来源无效。", false);
  }

  if (suppliedOrigin) {
    try {
      const normalizedSuppliedOrigin = new URL(suppliedOrigin).origin;
      if (normalizedSuppliedOrigin === normalizedExpectedOrigin && suppliedOrigin === normalizedSuppliedOrigin) return;
    } catch {
      // Fall through to the uniform safe rejection below.
    }
    throw new StorageApiError("forbidden_origin", 403, "仅允许同源写入请求。", false);
  }

  // Some browsers omit Origin for same-origin fetches. Sec-Fetch-Site is a
  // browser-controlled forbidden header and is the preferred fallback. The
  // Referer fallback keeps older browsers working without accepting a
  // cross-site page, which cannot forge a same-origin browser referrer.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin") return;
  const suppliedReferer = request.headers.get("referer");
  if (suppliedReferer) {
    try {
      if (new URL(suppliedReferer).origin === normalizedExpectedOrigin) return;
    } catch {
      // Fall through to the uniform safe rejection below.
    }
  }

  if (fetchSite) throw new StorageApiError("forbidden_origin", 403, "仅允许同源写入请求。", false);
  throw new StorageApiError("forbidden_origin", 403, "写入请求缺少同源校验信息。", false);
}
