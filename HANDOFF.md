# Enterprise Agent Hub 项目交接文档

最后更新：2026-07-19（Asia/Shanghai）

这份文档面向没有当前对话上下文的接手者。任何提交、发布或部署前，先实时核对 Git、工作区和测试，不要依据本文预填尚未产生的 commit。不得读取或打印 `.env.local`、数据库连接串、Cookie、Token、API Key 或 Secret。

## 1. 当前版本与边界

当前开发版本是 **V2.2.3：界面体验与产品质感优化**，开发分支为 `feature/v2.2.3-ui-product-polish`，基线 master 为 `780d104bf331aa917bb4e9e27be1b746243b5c1d`，上一稳定标签为 `v2.2.2-stable`。

V2.2.3 在 V2.2.2 生产加固基线上进行前端体验收口：

- 统一页面背景、内容表面、文字、边框、状态、焦点、圆角、间距和动效 Token。
- 为全局导航增加当前页状态、Skip Link 和窄屏可达性。
- 优化 Chat 文档式回答、会话侧栏、Composer、RAG 依据和安全 Trace 层级。
- 优化知识库、企业知识包、批量导入预览、任务状态与文档 master/detail 信息层级。
- 优化评测中心、运行监控、业务工具、首页和 About 的数据密度与中文状态。
- 统一 Loading、Empty、Error、Degraded、Conflict 等状态，并补齐响应式、键盘和 reduced-motion 验证。

`redesign-existing-projects` Skill 仅作为审查和设计指导；企业工作台定位优先。明确不包含：业务核心语义改动、数据库 Schema/migration、对象存储、OCR、完整账号权限、向量数据库、长期记忆、跨会话记忆、Node 22、大型 UI 框架或腾讯云部署。

腾讯云应用仍运行 V2.0.4。本轮只发布 Git 版本，不执行生产 PostgreSQL migration、服务器 Release、Canary 或 PM2 切换。

## 2. 接手检查

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

如果工作区包含 V2.2.3 未提交实现，必须原地保留并继续；不得 reset、restore、stash、clean 或覆盖。如果出现 `.env.local`、测试数据库数据、临时截图/录像、真实凭据或无关改动，停止并报告。

## 3. 数据与工作区模型

- PostgreSQL 是 server 模式正式数据源；ORM 保持 Prisma 6.19.3，Node 基线保持 20.19.5。
- HttpOnly、SameSite=Lax 的签名不透明 Cookie 解析匿名 Workspace；生产环境使用 Secure。
- 客户端传入的 `workspaceId` 不作为授权依据。KnowledgePack、ImportJob、ImportItem、KnowledgeDocument 和 KnowledgeChunk 查询必须限定服务端解析的 workspaceId。
- `KnowledgeDocument.packId` 是现有内置 RAG 分类；V2.2.1 `knowledgePackId` 是工作区企业知识包，不能混用。
- KnowledgePack 使用 revision/CAS；同工作区规范化名称唯一，文档计数由可靠查询计算。
- ImportJob 保存状态、总数、成功/失败/跳过/冲突计数、revision 和完成信息。
- ImportItem 保存受限提取文本、预览、冲突、安全错误、retry、claim token 和 lease；不保存原始文件。

V2.2.2 正式新增 migration：`prisma/migrations/20260718000000_v222_production_hardening/migration.sql`。它从 V2.2.1 增加规范化查询字段和必要索引，不删除旧数据。

## 4. 导入链路

```text
客户端选择文件并基础校验
→ 同源 multipart 请求
→ 服务端 Workspace 解析
→ 扩展名 / MIME / 签名 / 实际结构校验
→ 文本提取
→ 幂等 checksum 预检
→ checksum 与工作区既有文档、同批文件重复检测
→ 生产 RAG 分块器生成预览与质量诊断
→ 持久化 preview_ready Job / Items（不写正式文档）
→ 用户编辑元数据并确认 skip / replace / import_as_new
→ process 每次 claim 一个 Item
→ 文档与 chunks 同事务提交
→ 汇总、恢复、失败重试或取消
```

并发安全：任务确认、处理、重试与取消使用 revision；处理器使用随机 claim token、30 秒 lease 与 10 秒续租防重复消费；lease 到期后新处理器可恢复，旧 token 不能完成；最多重试 3 次。单项写入事务失败不会留下半文档，已成功项不会因重试重复导入，replace 复核同工作区目标及其 revision。

支持限制集中在 `src/lib/knowledge/import-limits.ts`：单批 10 个、单文件 5 MiB、单批 25 MiB、提取后 120,000 字符、最多 500 chunks、PDF 最多 200 页、DOCX 总解压 50 MiB；解析 10 秒、预览整体 60 秒、单项处理 20 秒、处理会话 90 秒。扫描型 PDF 无可提取文本时明确失败，不执行 OCR。

## 5. Repository 与存储模式

- KnowledgePack：`src/lib/storage/knowledgePackRepository.ts`、`src/lib/server-storage/knowledgePackRepository.ts`。
- KnowledgeImport：`src/lib/storage/knowledgeImportRepository.ts`、`src/lib/server-storage/knowledgeImportRepository.ts`。
- KnowledgeDocument：`src/lib/storage/knowledgeRepository.ts`、`src/lib/server-storage/knowledgeRepository.ts`。

模式语义：

- `local`：保留 V2.2.0 单文档本地导入和本地 RAG；企业知识包与批量任务提示需要服务端存储。
- `server`：知识包、任务、文档和 chunks 以 PostgreSQL 为唯一正式来源。
- `degraded`：可展示已加载内容，不启动或推进正式任务，不静默写 localStorage 假装成功。

任务自身保存在数据库。浏览器 `sessionStorage` 只保留当前任务 ID，用于刷新后重新 GET，不保存完整正文或任务结果；指针丢失、失效或只指向旧完成结果时，客户端会从当前 Workspace 最近 10 个可恢复任务中发现最新任务。

## 6. 关键文件

- Schema / migration：`prisma/schema.prisma`、`prisma/migrations/20260717000000_v221_knowledge_pack_import/`
- 文件限制、解析和质量：`src/lib/knowledge/import-limits.ts`、`file-parser.ts`、`import-quality.ts`
- 安全 metadata：`src/lib/knowledge/safe-metadata.ts`
- 服务端任务：`src/lib/server-storage/knowledgeImportRepository.ts`
- API：`src/app/api/storage/knowledge/packs/`、`src/app/api/storage/knowledge/import/`
- 前端控制器与面板：`src/components/knowledge-workspace/useKnowledgeImportWorkspace.ts`、`KnowledgeBatchImportPanel.tsx`、`WorkspaceKnowledgePackPanel.tsx`
- 工作区知识 RAG：`src/lib/server-storage/agentKnowledge.ts`
- 安全 Ops 聚合：`src/lib/server-storage/status.ts`
- 架构和限制：`docs/knowledge-import-architecture.md`、`docs/knowledge-import-limits.md`
- Migration：`docs/v2.2.1-database-migration.md`
- 生产加固：`docs/v2.2.2-production-hardening.md`
- 数据库运维：`docs/v2.2.2-database-operations.md`
- Release Notes：`docs/v2.2.2-release-notes.md`
- V2.2.3 UI 规范：`docs/v2.2.3-ui-guidelines.md`
- V2.2.3 Release Notes：`docs/v2.2.3-release-notes.md`

## 7. API 与安全

- Knowledge Pack：`/api/storage/knowledge/packs`、`/api/storage/knowledge/packs/:id`。
- Import：`/api/storage/knowledge/import/preview`、`/jobs`、`/jobs/:id`、`/process`、`/retry`、`/cancel`。
- 所有写接口必须执行同源/Origin 检查、严格大小与结构校验，并通过 Cookie 获取 Workspace。
- API 和日志不得返回完整 extractedText、完整 checksum、原始文件、本机路径、Prisma 堆栈、数据库 URL 或 Secret。
- metadata 只接受受限 JSON，并拒绝 `__proto__`、`constructor`、`prototype`。
- Ops 只记录聚合计数和白名单化 parser/duplicate 枚举；无口令或错误口令继续返回 401。

## 8. 验证门禁

按 `package.json` 真实脚本执行：

```powershell
npm.cmd run db:generate
npm.cmd run db:validate
npm.cmd run test:knowledge-import
npm.cmd run test:storage
npm.cmd run test:storage:postgres
npm.cmd run test:migration:v221
npm.cmd run test:migration:v222
npm.cmd run test:real-api:node20
npm.cmd run test:import:hardening
npm.cmd run test:import:stress
npm.cmd run production:check
npm.cmd run test:ui
npm.cmd run test:run
npm.cmd run typecheck
npm.cmd run build
npm.cmd run evaluation:mock
npm.cmd run e2e
git diff --check
```

真实 PostgreSQL 门禁只能使用独立 PostgreSQL 16 测试库，设置测试专用 `RUN_POSTGRES_INTEGRATION=1` 与 `TEST_DATABASE_URL`；不得连接腾讯云生产数据库、输出连接串或执行 `prisma migrate reset`。`test:migration:v221` 验证 V2.2.0 → V2.2.1，`test:migration:v222` 验证带旧数据的 V2.2.1 → V2.2.2 和重复 deploy；CI 还会运行 claim/lease 恢复、查询计划和真实 server-mode Workspace 隔离 E2E。

最后一次代码变化后必须完整重跑。任一关键门禁失败，不提交稳定 master、不创建 Tag、不部署。

## 9. Git 发布

全部 feature 门禁通过后：

1. 按逻辑提交 V2.2.3 UI、测试和文档。
2. 普通 push `feature/v2.2.3-ui-product-polish`，等待 GitHub feature CI。
3. fetch 并确认 `origin/master` 仍是预期基线；未知前进立即停止。
4. `--no-ff` 合并到 master，不 squash、rebase 或改写历史。
5. 从 merge commit 重新执行全部门禁。
6. push master，并确认 GitHub master CI。
7. 在最终 master merge commit 创建附注 `v2.2.3-stable` 并 push。

禁止 force push、tag -f、移动 `v2.2.2-stable`、删除 feature 分支或自动部署腾讯云。

## 10. 当前发布状态

V2.2.3 的最终 commit、feature/master CI、合并 commit、门禁数字和 Stable Tag 只能在操作实际成功后写入最终报告，不在交接文档中预填。

截至本文更新时，腾讯云仍为 V2.0.4，V2.2.3 尚未部署云端。
