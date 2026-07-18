import { randomUUID } from "node:crypto";
import { ImportJobStatus, KnowledgePackStatus, Prisma, type KnowledgePack as KnowledgePackRecord } from "@prisma/client";
import { getPrismaClient } from "@/lib/server-storage/prisma";
import {
  KnowledgePackRepositoryError,
  normalizeKnowledgePackName,
  sanitizeCreateKnowledgePackInput,
  sanitizeDeleteKnowledgePackInput,
  sanitizeUpdateKnowledgePackInput,
  type CreateKnowledgePackInput,
  type DeleteKnowledgePackInput,
  type KnowledgePackRepository,
  type UpdateKnowledgePackInput,
} from "@/lib/storage/knowledgePackRepository";
import type { WorkspaceKnowledgePack } from "@/types";

type PackWithCount = KnowledgePackRecord & { _count: { documents: number } };
type TransactionClient = Prisma.TransactionClient;

const packWithCount = { _count: { select: { documents: true } } } as const;

function toPack(record: PackWithCount): WorkspaceKnowledgePack {
  return {
    id: record.id,
    name: record.name,
    ...(record.description ? { description: record.description } : {}),
    status: record.status === KnowledgePackStatus.ARCHIVED ? "archived" : "active",
    documentCount: record._count.documents,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function translatePrismaError(error: unknown): never {
  if (error instanceof KnowledgePackRepositoryError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new KnowledgePackRepositoryError("同一工作区内已存在同名知识包。", 409, "knowledge_pack_name_conflict");
    if (error.code === "P2034") throw new KnowledgePackRepositoryError("知识包已发生并发更改，请刷新后重试。", 409, "knowledge_pack_revision_conflict");
    if (error.code === "P2025") throw new KnowledgePackRepositoryError("知识包不存在。", 404, "knowledge_pack_not_found");
    if (error.code === "P2003") throw new KnowledgePackRepositoryError("知识包仍被其他记录引用，暂时无法删除。", 409, "knowledge_pack_in_use");
  }
  throw new KnowledgePackRepositoryError("服务端知识包存储暂不可用。", 503, "server_storage_unavailable");
}

async function claimRevision(tx: TransactionClient, workspaceId: string, id: string, expectedRevision: number) {
  const claimed = await tx.knowledgePack.updateMany({
    where: { workspaceId, id, revision: expectedRevision },
    data: { revision: { increment: 1 }, updatedAt: new Date() },
  });
  if (claimed.count === 1) return;
  const exists = await tx.knowledgePack.count({ where: { workspaceId, id } });
  throw new KnowledgePackRepositoryError(
    exists ? "知识包已发生变化，请刷新后重试。" : "知识包不存在。",
    exists ? 409 : 404,
    exists ? "knowledge_pack_revision_conflict" : "knowledge_pack_not_found",
  );
}

export class PrismaKnowledgePackRepository implements KnowledgePackRepository {
  constructor(private readonly workspaceId: string, private readonly prisma = getPrismaClient()) {}

  async list() {
    const records = await this.prisma.knowledgePack.findMany({
      where: { workspaceId: this.workspaceId },
      orderBy: { updatedAt: "desc" },
      include: packWithCount,
    });
    return records.map(toPack);
  }

  async get(id: string) {
    const record = await this.prisma.knowledgePack.findUnique({
      where: { workspaceId_id: { workspaceId: this.workspaceId, id } },
      include: packWithCount,
    });
    return record ? toPack(record) : null;
  }

  async create(input: CreateKnowledgePackInput) {
    const safe = sanitizeCreateKnowledgePackInput(input);
    if (!safe) throw new KnowledgePackRepositoryError("知识包信息不符合规则。", 400, "invalid_knowledge_pack");
    try {
      const record = await this.prisma.knowledgePack.create({
        data: {
          workspaceId: this.workspaceId,
          id: randomUUID(),
          name: safe.name,
          normalizedName: normalizeKnowledgePackName(safe.name),
          description: safe.description,
          status: KnowledgePackStatus.ACTIVE,
        },
        include: packWithCount,
      });
      return toPack(record);
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async update(id: string, input: UpdateKnowledgePackInput) {
    const safe = sanitizeUpdateKnowledgePackInput(input);
    if (!safe) throw new KnowledgePackRepositoryError("知识包更新信息不符合规则。", 400, "invalid_knowledge_pack_update");
    try {
      return await this.prisma.$transaction(async (tx) => {
        await claimRevision(tx, this.workspaceId, id, safe.expectedRevision);
        await tx.knowledgePack.update({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id } },
          data: {
            ...(safe.name ? { name: safe.name, normalizedName: normalizeKnowledgePackName(safe.name) } : {}),
            ...(Object.prototype.hasOwnProperty.call(safe, "description") ? { description: safe.description } : {}),
            ...(safe.status ? { status: safe.status === "archived" ? KnowledgePackStatus.ARCHIVED : KnowledgePackStatus.ACTIVE } : {}),
          },
        });
        const updated = await tx.knowledgePack.findUnique({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id } },
          include: packWithCount,
        });
        if (!updated) throw new KnowledgePackRepositoryError("知识包不存在。", 404, "knowledge_pack_not_found");
        return toPack(updated);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async remove(id: string, input: DeleteKnowledgePackInput) {
    const safe = sanitizeDeleteKnowledgePackInput(input);
    if (!safe) throw new KnowledgePackRepositoryError("知识包删除请求不符合规则。", 400, "invalid_knowledge_pack_delete");
    try {
      return await this.prisma.$transaction(async (tx) => {
        await claimRevision(tx, this.workspaceId, id, safe.expectedRevision);
        const activeImportCount = await tx.importJob.count({
          where: {
            workspaceId: this.workspaceId,
            status: {
              in: [
                ImportJobStatus.PENDING,
                ImportJobStatus.RUNNING,
                ImportJobStatus.PREVIEW_READY,
                ImportJobStatus.PROCESSING,
                ImportJobStatus.PARTIAL_FAILED,
                ImportJobStatus.FAILED,
              ],
            },
            OR: [
              { knowledgePackId: id },
              { items: { some: { previewMetadata: { path: ["knowledgePackId"], equals: id } } } },
            ],
          },
        });
        if (activeImportCount > 0) {
          throw new KnowledgePackRepositoryError("知识包仍有未完成的导入任务，请先完成或取消任务。", 409, "knowledge_pack_has_active_imports");
        }
        const documentCount = await tx.knowledgeDocument.count({ where: { workspaceId: this.workspaceId, knowledgePackId: id } });
        if (safe.deleteDocuments) {
          await tx.knowledgeDocument.deleteMany({ where: { workspaceId: this.workspaceId, knowledgePackId: id } });
        } else {
          await tx.knowledgeDocument.updateMany({
            where: { workspaceId: this.workspaceId, knowledgePackId: id },
            data: { knowledgePackId: null, revision: { increment: 1 } },
          });
        }
        await tx.importJob.updateMany({
          where: { workspaceId: this.workspaceId, knowledgePackId: id },
          data: { knowledgePackId: null, revision: { increment: 1 } },
        });
        await tx.knowledgePack.delete({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } } });
        return {
          detachedDocumentCount: safe.deleteDocuments ? 0 : documentCount,
          deletedDocumentCount: safe.deleteDocuments ? documentCount : 0,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }
}
