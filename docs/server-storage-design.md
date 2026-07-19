# V2.2.x 服务端存储设计

## 1. 目标与非目标

服务端存储用于持久化当前浏览器工作区的会话、消息、滚动摘要和用户知识数据。它解决刷新、浏览器缓存清理以外的可靠持久化基础，并为未来正式工作区与用户体系预留 workspaceId。

本版本不实现完整登录、企业组织、跨浏览器账号恢复、角色权限、对象存储、向量数据库、长期记忆或跨 Conversation 记忆。

## 2. 技术选择

- 数据库：PostgreSQL。
- ORM：Prisma 6.19.3。
- Node 运行基线：Node 20.19.5；不要求 Node 22。
- 正式 Schema：`prisma/schema.prisma`。
- 迁移：`prisma/migrations/` 中的不可变 SQL migration。

选择 Prisma 的原因是：成熟的 PostgreSQL 支持、类型化 Client、事务支持、可审查 migration 和 Node 20 兼容性。测试可以注入 Repository/Prisma mock，但正式数据模型不以 SQLite、JSONL 或内存存储替代 PostgreSQL。

## 3. 工作区身份

```text
浏览器请求
→ 读取签名的不透明 HttpOnly Cookie
→ 校验 HMAC 签名
→ 计算会话令牌 SHA-256 哈希
→ 只读 GET 仅查找已有 Workspace；写请求在缺少会话时创建 Workspace
→ 得到服务端 workspaceId
→ 所有业务查询附带 workspaceId
```

Cookie 使用 HttpOnly、Path=/、SameSite=Lax；生产环境增加 Secure。Cookie 原文、签名 Secret 和数据库 URL 不进入日志或 API 响应。客户端提交的 workspaceId 不被信任、也不作为授权依据；工作区始终由服务端 Cookie 会话解析。

当前一个匿名 Cookie 对应一个 Workspace。这是浏览器级隔离，不应宣传为完整多租户认证。

无有效 Cookie 的只读 GET 不会签发新会话或创建 Workspace：列表返回空结果，单记录返回 404，状态接口只返回安全存储状态。这避免了爬虫、健康检查或未建立会话的读取请求制造空 Workspace。

## 4. PostgreSQL Schema

### Workspace

- `id`：服务端随机 ID。
- `name`：当前默认“匿名工作区”。
- `sessionTokenHash`：会话令牌哈希，唯一。
- `createdAt` / `updatedAt`。

### Conversation

- 复合主键 `(workspaceId, id)`，兼容现有本地 ID。
- `title` / `titleSource` / `createdAt` / `updatedAt`。
- `revision`：CAS 版本，默认 0。
- `schemaVersion`：服务端记录版本。
- `conversationSummary`：可选 JsonB 原子对象。
- `deletedAt`：软删除标记。

Summary 兼容：

```ts
type ConversationSummaryState = {
  text: string;
  throughMessageId: string;
  updatedAt: string;
  version: 1;
  sourceMessageCount: number;
};
```

### Message

- 复合主键 `(workspaceId, id)`。
- 通过 `(workspaceId, conversationId)` 关联同一工作区 Conversation。
- role 仅接受 user / assistant。
- `messageOrder` 提供稳定时序，并在单 Conversation 内唯一。
- 可选 `runId`、`responseMode`、scenario、intent 和安全 `assistantDetails` JsonB。

pending、partial、aborted 或失败回答不写入该表。

### KnowledgeDocument / KnowledgeChunk

- 文档保存受限大小文本正文、sourceType、enabled、tags、metadata、checksum 和现有质量诊断字段。
- V2.2.2 增加可空的 `normalizedTitle` 与 `normalizedFileName`，旧数据在 PostgreSQL 16 migration 中以 NFKC 规则回填，用于当前 Workspace 内的重复候选查询；Repository 在创建和相关更新时同步维护。
- Chunk 保存稳定 `chunkIndex`、content 与 keywords。
- 文档删除通过数据库外键级联删除 chunks。
- 文档更新在事务中同步 checksum 和重建 chunks。
- 所有查询均以 workspaceId 隔离；RAG 只读取当前工作区 enabled 文档。

### ImportJob

V2.2.0 保存单文档导入的基础状态、可选 documentId 和安全 errorCode。V2.2.1 扩展为持久化批量任务，增加知识包、进度计数、revision、幂等键、完成时间和耗时，并通过 ImportItem 记录每个文件的预览、冲突、claim/lease、重试与结果。`documentId` 是用于保留导入审计历史的非外键引用，因此文档后续被删除时，ImportJob 仍可保留当时的文档标识；业务查询不会将该字段当作当前文档存在性的保证。

### KnowledgePack / ImportItem（V2.2.1）

- KnowledgePack 以 `(workspaceId, id)` 为复合主键，同工作区规范化名称唯一；文档通过可空 `knowledgePackId` 归组。
- 默认删除知识包只解除文档归属；同时删除文档需要明确二次确认并在事务中完成。
- ImportItem 与 ImportJob 使用同工作区复合外键，每项保存受限解析结果、预览、冲突、安全错误和处理租约。
- 原始上传文件不进入数据库；成功文档和 chunks 在同一事务创建或替换。

完整设计见 `docs/knowledge-import-architecture.md`。

### V2.2.2 查询索引

- `conversations_active_updated_idx`：当前工作区未删除会话按更新时间分页。
- `messages_run_id_lookup_idx`：当前会话 assistant runId 幂等查找。
- `knowledge_documents_normalized_title_idx` / `knowledge_documents_normalized_file_name_idx`：重复候选查询。
- `import_jobs_status_updated_idx`：可恢复任务与状态列表。
- `import_items_job_status_order_idx` / `import_items_claim_queue_idx`：任务内待处理项和过期 lease 领取。
- `import_items_workspace_status_idx`、`import_items_workspace_error_idx`、`import_items_workspace_conflict_idx`：安全聚合统计。

这些索引均以 `workspaceId` 作为首列，不扩大跨工作区可见范围；V2.2.2 migration 不删除业务表、列或数据。

### StorageMigration

以 `(workspaceId, migrationId)` 为主键，保存状态、imported/skipped/conflicted/failed 聚合计数和安全结果 JsonB，用于幂等迁移。

## 5. Repository 架构

```text
Chat / Knowledge UI
→ ConversationRepository / KnowledgeRepository
   ├─ Local*Repository → 现有 localStorage sanitizer 与写入语义
   └─ Server*Repository → /api/storage/* → workspace resolver → Prisma Repository
```

Repository 接口隔离 UI 与传输/数据库细节。Local 和 Server 必须保持相同业务语义，尤其是 Regenerate、Edit & Resend、Summary Patch、文档启用/停用和删除。

## 6. Conversation 事务与 CAS

每个写请求携带 `expectedRevision`。服务端事务只在当前 revision 匹配时更新：

- appendTurn：插入完整 user/assistant、应用 Summary Patch、revision + 1。
- Regenerate：校验最后 assistant ID，替换 assistant、重置反馈语义、应用 Patch、revision + 1。
- Edit & Resend：校验 user/assistant ID，截断旧尾部、插入新 turn、应用 Patch、revision + 1。
- rename / delete / clear：同样限定工作区与 expectedRevision。

CAS 冲突返回 409。事务失败时消息、摘要和 revision 均不部分推进。

## 7. REST API

| 范围 | 路径 | 说明 |
| --- | --- | --- |
| 状态 | `GET /api/storage/status` | 仅返回 configured、healthy、storageMode、databaseType |
| 会话 | `/api/storage/conversations` | 列表与创建 |
| 会话 | `/api/storage/conversations/:id` | 获取、重命名、删除 |
| 会话 | `/api/storage/conversations/:id/turns` | 追加完整 turn |
| 会话 | `/api/storage/conversations/:id/regenerate` | CAS 重生成最后 assistant |
| 会话 | `/api/storage/conversations/:id/edit-resend` | CAS 编辑并重发最后 turn |
| 会话 | `/api/storage/conversations/:id/clear` | CAS 清空会话 |
| 知识 | `/api/storage/knowledge` | 列表与单文档创建 |
| 知识 | `/api/storage/knowledge/:id` | 获取、更新、删除 |
| 知识 | `/api/storage/knowledge/:id/chunks` | 获取文档 chunks |
| 知识 | `POST /api/storage/knowledge/restore` | 单事务替换当前工作区知识备份并重建 chunks |
| 企业知识包 | `/api/storage/knowledge/packs` | 工作区内列表与创建 |
| 企业知识包 | `/api/storage/knowledge/packs/:id` | 详情、revision/CAS 修改和删除 |
| 批量导入 | `POST /api/storage/knowledge/import/preview` | 多文件服务端解析、重复检测与持久化预览 |
| 批量导入 | `POST /api/storage/knowledge/import/jobs` | 确认元数据与冲突策略 |
| 批量导入 | `GET /api/storage/knowledge/import/jobs/:id` | 恢复任务进度与安全结果 |
| 批量导入 | `POST .../:id/process` | claim 并处理最多一个项目 |
| 批量导入 | `POST .../:id/retry` | 仅重置失败项，成功项保持完成 |
| 批量导入 | `POST .../:id/cancel` | 取消未完成项，不删除已成功文档 |
| 迁移 | `POST /api/storage/migration/preview` | 迁移预检 |
| 迁移 | `POST /api/storage/migration` | 用户确认后的幂等执行 |

所有写路由执行同源检查、严格 Payload 校验和容量限制。错误使用安全 code/message，不返回 Prisma 堆栈或数据库内部信息。

## 8. 存储模式

- local：`SERVER_STORAGE_ENABLED` 未启用。浏览器沿用 V2.1.0 localStorage。
- server：功能启用，DATABASE_URL 与 STORAGE_SESSION_SECRET 已配置，健康检查通过。服务端为写入数据源。
- degraded：功能已启用但配置不完整或健康检查失败。可展示浏览器中已有的本地兼容数据（如有），写操作明确失败，不自动落回 localStorage。

恢复后客户端重新读取服务器状态与最新 revision；不会自动以本地数据覆盖服务端。

## 9. 隐私与可观测性

Storage 状态与 Ops 仅包含：storageMode、databaseConfigured、databaseHealthy、conversationCount、messageCount、knowledgeDocumentCount、knowledgePackCount、importJobCount、importItemCount、importSuccessCount、importFailureCount、importConflictCount、importRetryCount、averageImportDuration、白名单 parser/duplicate 分布、migrationCount、storageErrorCount。

不得记录消息正文、Summary 正文、知识正文、RAG chunk、Tool 原始输出、DATABASE_URL、Cookie 或 STORAGE_SESSION_SECRET。Ops 鉴权规则保持不变。

## 10. 回滚

- 未启用服务端存储时不改变现有 localStorage 行为。
- 迁移永不删除 localStorage 原数据。
- 服务端应用回滚到 V2.1.0 时，浏览器本地数据仍可读；PostgreSQL 表保留等待恢复。
- 数据库 migration 只向前部署；生产回滚需以部署前数据库备份和经审查的恢复方案为准，不执行 reset。
