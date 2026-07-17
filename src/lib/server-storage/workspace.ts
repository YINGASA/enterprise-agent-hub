import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getServerStorageConfiguration } from "@/lib/server-storage/config";
import { getPrismaClient } from "@/lib/server-storage/prisma";
import { StorageApiError } from "@/lib/server-storage/errors";

export const WORKSPACE_COOKIE_NAME = "enterprise_agent_hub_workspace";
export const WORKSPACE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type WorkspaceScope = { workspaceId: string };
export type WorkspaceResolution = WorkspaceScope & { setCookie?: string };

export type AnonymousWorkspaceRecord = { id: string };
export type AnonymousWorkspaceRepository = {
  findBySessionTokenHash(sessionTokenHash: string): Promise<AnonymousWorkspaceRecord | null>;
  create(input: { id: string; name: string; sessionTokenHash: string }): Promise<AnonymousWorkspaceRecord>;
};

type ResolveWorkspaceOptions = {
  repository?: AnonymousWorkspaceRepository;
  storageEnabled?: boolean;
  sessionSecret?: string;
  secureCookie?: boolean;
  generateToken?: () => string;
  generateWorkspaceId?: () => string;
  createIfMissing?: boolean;
};

type CreateWorkspaceOptions = Omit<ResolveWorkspaceOptions, "createIfMissing"> & { createIfMissing?: true };
type ReadOnlyWorkspaceOptions = Omit<ResolveWorkspaceOptions, "createIfMissing"> & { createIfMissing: false };

function encodeSignature(token: string, sessionSecret: string): string {
  return createHmac("sha256", sessionSecret).update(token).digest("base64url");
}

function signToken(token: string, sessionSecret: string): string {
  return `${token}.${encodeSignature(token, sessionSecret)}`;
}

function extractVerifiedToken(cookieValue: string | undefined, sessionSecret: string): string | undefined {
  if (!cookieValue || cookieValue.length > 96) return undefined;
  const [token, suppliedSignature, extra] = cookieValue.split(".");
  if (extra !== undefined || !token || !suppliedSignature || !/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature)) return undefined;
  const expectedSignature = encodeSignature(token, sessionSecret);
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return undefined;
  return token;
}

function sessionTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function serializeWorkspaceCookie(value: string, secure: boolean): string {
  return [
    `${WORKSPACE_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${WORKSPACE_COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : undefined,
  ].filter(Boolean).join("; ");
}

export function createPrismaWorkspaceRepository(prisma: PrismaClient): AnonymousWorkspaceRepository {
  return {
    async findBySessionTokenHash(hash) {
      return prisma.workspace.findUnique({ where: { sessionTokenHash: hash }, select: { id: true } });
    },
    async create(input) {
      return prisma.workspace.create({ data: input, select: { id: true } });
    },
  };
}

export async function resolveAnonymousWorkspace(
  cookieValue: string | undefined,
  repository: AnonymousWorkspaceRepository,
  options: Required<Pick<ResolveWorkspaceOptions, "sessionSecret" | "secureCookie">> & Pick<ResolveWorkspaceOptions, "generateToken" | "generateWorkspaceId">,
): Promise<WorkspaceResolution> {
  const generateToken = options.generateToken ?? (() => randomBytes(32).toString("base64url"));
  const generateWorkspaceId = options.generateWorkspaceId ?? randomUUID;
  let token = extractVerifiedToken(cookieValue, options.sessionSecret);
  let setCookie: string | undefined;

  if (!token) {
    token = generateToken();
    setCookie = serializeWorkspaceCookie(signToken(token, options.sessionSecret), options.secureCookie);
  }

  const hash = sessionTokenHash(token);
  const existing = await repository.findBySessionTokenHash(hash);
  if (existing) return { workspaceId: existing.id, setCookie };

  const created = await repository.create({ id: generateWorkspaceId(), name: "匿名工作区", sessionTokenHash: hash });
  return { workspaceId: created.id, setCookie };
}

async function resolveExistingAnonymousWorkspace(
  cookieValue: string | undefined,
  repository: AnonymousWorkspaceRepository,
  sessionSecret: string,
): Promise<WorkspaceResolution | null> {
  const token = extractVerifiedToken(cookieValue, sessionSecret);
  if (!token) return null;
  const existing = await repository.findBySessionTokenHash(sessionTokenHash(token));
  return existing ? { workspaceId: existing.id } : null;
}

export function resolveRequestWorkspace(request: Request, options: ReadOnlyWorkspaceOptions): Promise<WorkspaceResolution | null>;
export function resolveRequestWorkspace(request: Request, options?: CreateWorkspaceOptions): Promise<WorkspaceResolution>;
export async function resolveRequestWorkspace(request: Request, options: ResolveWorkspaceOptions = {}): Promise<WorkspaceResolution | null> {
  const storageEnabled = options.storageEnabled ?? getServerStorageConfiguration().storageEnabled;
  if (!storageEnabled) {
    throw new StorageApiError("storage_unavailable", 503, "服务端存储未启用。", false);
  }
  const sessionSecret = options.sessionSecret ?? process.env.STORAGE_SESSION_SECRET?.trim();
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new StorageApiError("storage_misconfigured", 503, "服务端存储会话尚未正确配置。", false);
  }
  const repository = options.repository ?? createPrismaWorkspaceRepository(getPrismaClient());
  const cookieValue = readCookie(request.headers.get("cookie"), WORKSPACE_COOKIE_NAME);
  if (options.createIfMissing === false) {
    return resolveExistingAnonymousWorkspace(cookieValue, repository, sessionSecret);
  }
  return resolveAnonymousWorkspace(cookieValue, repository, {
    sessionSecret,
    secureCookie: options.secureCookie ?? process.env.NODE_ENV === "production",
    generateToken: options.generateToken,
    generateWorkspaceId: options.generateWorkspaceId,
  });
}
