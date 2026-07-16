# Enterprise Agent Hub 项目交接文档

最后更新：2026-07-16（Asia/Shanghai）

这份文档面向没有当前上下文的新会话。先核对 Git 和工作区，再执行测试、提交、发布或服务器操作。不要读取或打印 `.env.local`、数据库连接串、Cookie、Token、API Key 或 Secret。

## 1. 当前任务与边界

当前开发版本是 **V2.2.0：服务端存储与持久化**，开发分支为 `feature/v2.2.0-server-storage`。本版本在 V2.1.0 Conversation Context Manager 上增加可选 PostgreSQL 服务端存储，但不增加完整登录系统、长期记忆、跨会话记忆、对象存储、向量数据库或新业务场景。

当前 Git 基线：

- V2.1.0 正式 master merge commit：`60314ce063dda4eba7436aa0c414a108a8abe2a8`
- V2.1.0 Stable Tag：`v2.1.0-stable`
- 项目级设计审查 Skill 提交：`cf36ea5c1b29b2300f5a51e1b9648dc198633eaf`
- V2.2.0 feature 分支建立在上述本地提交之后；接手时必须用 `git rev-parse HEAD` 和 `git log` 实时核对，不要依赖本文档猜测尚未创建的最终 commit。

V2.2.0 最终门禁、feature push、master merge 和 `v2.2.0-stable` 只在全部实现与验证通过后执行。当前文档不预填尚未得到的测试数字或 Git commit。

云端边界：本轮不更新腾讯云应用版本、不切换 PM2、不执行 Canary；腾讯云线上应用仍保持 V2.0.4。只有在真实 PostgreSQL 集成验证无法由独立本地/测试数据库完成时，才可使用隔离的测试数据库基础设施，且不得覆盖线上应用或生产数据。

## 2. 接手后的第一组检查

```powershell
Set-Location 'E:\codex\enterprise-agent-hub'
git branch --show-current
git status --short
git rev-parse HEAD
git rev-parse master
git rev-parse origin/master
git log -12 --oneline --decorate
git tag --list 'v2.*-stable' --sort=version:refname
git diff --check
```

同时读取：

- `C:\Users\LENOVO\.codex\memories\PROFILE.md`
- `C:\Users\LENOVO\.codex\memories\ACTIVE.md`

若工作区包含 V2.2.0 的未提交实现，保留并继续，不要 reset、restore、stash、clean 或覆盖。若出现 `.env.local`、运行数据、真实凭据或与 V2.2.0 无关的改动，停止并先报告。

## 3. V2.2.0 技术方案

### 数据库

- PostgreSQL 为正式数据源。
- ORM 使用 Prisma 6.19.3，明确兼容 Node 20。
- Schema 与初始 migration 位于 `prisma/`。
- 不使用 SQLite、内存库或 JSONL 代替生产数据库。
- 不执行 `prisma migrate reset`，也不接触腾讯云生产数据库。

### 匿名工作区隔离

- 服务端生成随机匿名工作区和不透明会话令牌。
- Cookie 名称由服务端固定，使用签名值、HttpOnly、SameSite=Lax；生产环境使用 Secure。
- 数据库存储令牌哈希，不保存 Cookie 原文。
- 客户端提供的 `workspaceId` 不被信任，也不作为授权依据；服务端始终以 Cookie 解析的工作区为准。
- Conversation、Message、KnowledgeDocument、KnowledgeChunk、ImportJob 和 StorageMigration 都带 `workspaceId`，所有查询与修改必须限定该值。
- 这是浏览器级隔离基础，不是完整身份认证，也不支持跨浏览器账号恢复。

### 数据模型

- `Workspace`：匿名工作区、会话令牌哈希和时间戳。
- `Conversation`：标题、时间戳、`revision`、可选原子 `conversationSummary` JSON、软删除时间。
- `Message`：user/assistant、正文、稳定顺序、runId、responseMode 和安全 assistant details。
- `KnowledgeDocument`：受限文本正文、来源类型、启用状态、tags、metadata、checksum 和现有知识诊断字段。
- `KnowledgeChunk`：稳定 chunkIndex、正文、keywords，与文档同工作区关联。
- `ImportJob`：单文档导入基础状态与安全 errorCode。
- `StorageMigration`：幂等 migrationId、聚合数量和迁移结果。

### Repository 与存储模式

- `ConversationRepository` 同时提供 Local / Server 适配器，保持 list/get/create/rename/delete/appendTurn/regenerate/editAndResend 语义一致。
- `KnowledgeRepository` 同时提供 Local / Server 适配器，保持文档 CRUD、启用状态和 chunks 读取语义一致。
- `local`：服务端存储未启用，继续使用 V2.1.0 localStorage。
- `server`：数据库已配置且健康，服务端为唯一写入数据源。
- `degraded`：数据库已配置但不可用，可展示浏览器中已有的本地兼容数据（如有），写操作明确失败，不静默回写 localStorage。

## 4. 数据一致性与上下文链路

服务端 Conversation 写入使用 PostgreSQL 事务和 revision CAS：

- 普通发送：写入完整 user + assistant turn、应用 Summary Patch、revision + 1。
- Regenerate：校验 expectedRevision 和最后 assistant ID，替换回答、应用 Patch、revision + 1。
- Edit & Resend：校验 expectedRevision 和 user/assistant ID，截断旧尾部、写入新 turn、应用 Patch、revision + 1。
- CAS 失败返回 409，消息与 Summary 均不发生部分写入。
- pending、partial、aborted 或失败回答不写入 Message。

V2.1.0 上下文链路保持：

```text
有效历史前缀
→ Context Candidates
→ 请求校验
→ Router
→ RAG
→ Tool
→ History Selector
→ Rolling Summary
→ Context Manager
→ Mock / Real
→ Streaming / Non-streaming
→ Completion Fence
→ Repository 原子写入
```

服务端存储不新增第二次摘要模型调用。Rolling Summary 仍使用确定性增量逻辑；Summary 正文不得进入 Ops、Context Trace 或默认日志。

## 5. localStorage 迁移

迁移流程：发现本地数据 → 预检 → 用户确认 → 上传受限迁移包 → 服务端事务导入 → 返回 imported/skipped/conflicted/failed → 写入本地迁移状态标记。

- 保留原 Conversation、Message、Summary 和 KnowledgeDocument ID、时间与消息顺序。
- 使用由本地已净化数据确定性生成的 `migrationId`；重复提交返回既有结果，不重复生成记录。
- 服务器已有相同 ID 且内容一致：skipped。
- 相同 ID 但内容不一致：conflicted；服务器记录优先，不静默覆盖。
- 本地独有且容量允许：imported。
- localStorage 原 key 和原数据始终保留，只新增迁移状态标记。
- 迁移仅作用于 Cookie 解析出的当前工作区；即使请求出现 workspaceId，也不能据此改变授权范围。

详细说明见 `docs/local-storage-migration.md`。

## 6. 关键文件

- Prisma Schema：`prisma/schema.prisma`
- 初始迁移：`prisma/migrations/`
- 服务端存储配置与 Prisma Client：`src/lib/server-storage/config.ts`、`src/lib/server-storage/prisma.ts`
- 匿名工作区：`src/lib/server-storage/workspace.ts`
- Conversation Repository：`src/lib/storage/conversationRepository.ts`、`src/lib/server-storage/conversationRepository.ts`
- Knowledge Repository：`src/lib/storage/knowledgeRepository.ts`、`src/lib/server-storage/knowledgeRepository.ts`
- 存储状态：`src/lib/storage/status.ts`、`src/app/api/storage/status/route.ts`
- 迁移：`src/lib/server-storage/migration.ts`、`src/lib/storage/migrationClient.ts`、`src/app/api/storage/migration/`
- REST API：`src/app/api/storage/conversations/`、`src/app/api/storage/knowledge/`
- UI 状态与迁移入口：`src/components/StorageStatusPanel.tsx`
- 会话 Hook：`src/components/agent-workspace/useAgentWorkspace.ts`
- 知识 Hook：`src/components/knowledge-workspace/useKnowledgeWorkspace.ts`
- 安全聚合状态：`src/lib/server-storage/status.ts`、`src/app/api/ops/summary/route.ts`

## 7. 环境变量与安全

仅记录变量名，不记录值：

- `DATABASE_URL`
- `SERVER_STORAGE_ENABLED`
- `STORAGE_SESSION_SECRET`

安全规则：

- `.env.local` 不得读取、打印、修改或提交。
- 状态 API 只输出 configured、healthy、storageMode 和 databaseType。
- Ops 只记录存储模式和聚合计数，不记录数据库 URL、Cookie、Secret、消息正文、Summary 正文、知识正文、RAG 原文或 Tool 原始输出。
- 所有写 API 执行同源检查、Payload 校验和大小限制。
- 不运行 `npm audit fix`，不升级 Node 22，也不做无关依赖大版本升级。

## 8. 本地命令与发布门禁

先按 `package.json` 的真实脚本执行：

```powershell
npm.cmd run db:generate
npm.cmd run db:validate
npm.cmd run test:storage
npm.cmd run test:storage:postgres
npm.cmd run test:run
npm.cmd run typecheck
npm.cmd run build
npm.cmd run evaluation:mock
npm.cmd run e2e
git diff --check
```

如果需要 migration 状态或部署验证，使用隔离测试数据库：

```powershell
npm.cmd run db:status
npm.cmd run db:migrate:deploy
```

不得用真实生产 `.env.local` 运行测试。若当前环境没有独立 PostgreSQL，必须把“Prisma generate/validate 与静态 migration 验证”和“真实 PostgreSQL 集成测试”区分报告，不能把前者冒充后者。

## 9. Git 发布规则

只有最终代码和文档门禁全部通过后才可以：

1. 在 feature 分支按逻辑提交。
2. 普通 push `feature/v2.2.0-server-storage`，不 force。
3. fetch 后确认远端 master 没有未知前进。
4. 以 `--no-ff` 合并到 master。
5. 从合并后的 master 重新执行完整门禁。
6. 普通 push master。
7. 在 master merge commit 创建附注 `v2.2.0-stable` 并 push。

禁止 reset --hard、clean、rebase/squash 已发布历史、tag -f、force push、移动旧 Stable Tag 或删除历史分支。

## 10. 腾讯云状态

- 腾讯云当前应用版本仍为 V2.0.4。
- 本轮 Git 发布完成后停止，不创建服务器 Release、不切换 PM2、不做 Canary、不更新云端应用代码。
- 即使使用腾讯云上的独立 PostgreSQL 测试基础设施，也必须与线上 V2.0.4 应用和生产数据隔离，并且不能把连接信息写入仓库或日志。
- 后续云端部署必须单独授权，并按 `docs/server-storage-deployment-prerequisites.md` 完成备份、Secret、migration、健康检查与回滚准备。

## 11. 当前仍需完成

- 完成 V2.2.0 代码审计与缺口修复。
- 补齐 Repository、API、迁移、工作区隔离、degraded、RAG 与 E2E 回归。
- 执行最终 feature 门禁。
- 生成正式 commit、push feature、非快进合并 master。
- 从 master 重新完整验证后 push 并创建 `v2.2.0-stable`。
- 最终报告必须明确真实 PostgreSQL 测试方式、所有门禁结果、Git 指向，以及未更新腾讯云应用的事实。
