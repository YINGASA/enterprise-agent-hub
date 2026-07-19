# Enterprise Agent Hub

## V2.2.2 依赖兼容与生产导入加固

V2.2.2 在 V2.2.1 企业知识包基础上完成 Node 20 Real API 兼容、导入资源边界、claim/lease 恢复、PostgreSQL 查询索引、degraded 恢复与生产启动检查。它是生产加固版本，不新增大型业务功能或主界面改版。

运行基线保持 Node 20.19.5 与 Prisma 6.19.3。代理 Real API 使用的直接依赖精确固定到 Node 20 兼容的 `undici@7.28.0`；数据库层继续使用 PostgreSQL，所有知识包、任务、文档和 chunks 查询仍限定服务端解析的匿名 `workspaceId`。

V2.1.0 的 Context Plan、Rolling Summary、Streaming / Revision Safety，以及 V2.2.0 / V2.2.1 的持久化与知识导入语义保持不变。本版本不保存原始上传文件，不接入对象存储，不支持 OCR；腾讯云仍运行 V2.0.4，本次 Git 发布不执行云端部署。

面向企业知识库与业务流程自动化的 AI Agent 产品原型。

Enterprise Agent Hub 用于展示一个企业 AI Agent 从产品设计到工程实现的完整闭环：用户提出业务问题后，系统通过 Agent Router 判断场景与意图，结合 Hybrid RAG 检索、业务工具调用、Mock / Real API 双模式、结构化输出、fallback、评测面板和运行追踪，形成可解释、可评估、可复盘的 AI 应用体验。

## 项目定位

这是一个 AI 产品原型，不是单纯的 API 调用 Demo。项目重点展示企业 AI Agent 在以下环节中的设计和实现能力：

- 知识库问答：默认 Knowledge Packs + 用户本地导入文档共同参与 RAG。
- 业务工具调用：订单、商品、规则检索、客服回复和工单等本地工具可编排。
- 评测验证：内置 80 条多场景 Mock 评测用例，支持历史记录、趋势和报告导出。
- 运行追踪：Chat 侧可保存单次 Agent Run，导出 Router / RAG / Tools / LLM / Retriever Trace。
- 真实模型接入：支持 OpenAI-compatible / DeepSeek Real API，失败时 fallback 到 mock-agent。

## 核心场景

- 企业知识库问答：报销、差旅、请假、IT 权限、数据安全、设备申请等。
- 电商客服售后：订单查询、退货退款、售后规则、物流异常、客服回复。
- AI 工程规范问答：JSON repair、fallback、RAG 引用、Tool Calling、评测集设计。

## 核心能力

- Agent Router：规则版活动场景与意图识别，支持 enterprise / ecommerce / ai_engineering / general；已下线标识仅用于旧记录兼容。
- Hybrid RAG：关键词、标题、标签、分类、知识包、来源、业务短语、时效等多维评分。
- Retriever Adapter：封装 Hybrid Retriever，并预留 Mock Embedding / Auto 检索策略接口。
- Tool Calling：本地工具编排，覆盖订单、商品、规则检索、工单和客服回复。
- Mock / Real API 双模式：Mock 默认可用，Real API 通过服务端 API Route 调用模型。
- Knowledge Import：local 模式保留 txt / md / json / csv 单文档本地导入；server 模式增加 TXT、Markdown、文本型 PDF、DOCX 的多文件预览与持久化任务。
- 企业知识包：支持工作区内知识包 CRUD、批量文件归组、文档计数和删除知识包时默认保留文档。
- 导入安全：扩展名、MIME、文件签名和实际结构共同校验，限制批次、文件、提取正文、PDF 页数、DOCX 解压规模与解析并发；单服务进程预览总并发为 2，同 Workspace 为 1。
- 导入质量与冲突：复用生产分块器预览 chunks，诊断过短、过长、重复和低信息量内容；已有文档与同批文件均参与重复检测，支持 skip、replace、import_as_new。
- 导入任务：ImportJob / ImportItem 持久化预览与进度，使用 revision、claim 和 lease 防重复消费；浏览器短期任务指针丢失时可发现当前 Workspace 最近 10 个可恢复任务；处理失败项可重试，解析失败因不保存原文件需重新选择。
- 生产导入加固：服务端集中限制解析并发、预览/单项 deadline、最大 3 次重试、30 秒 claim lease 与 10 秒续租；过期任务可由新处理器安全接管，旧 claim 不能提交。
- Node 20 Real API：非流式和流式请求共用 AbortSignal 与安全完成语义；代理 dispatcher 会释放，本地假服务覆盖 HTTP/SSE、超时、停止和上游错误。
- 安全健康与启动检查：`/api/health` 只返回聚合状态；`npm run production:check` 在数据库、migration、Secret、parser 或 Node 基线不满足时 fail closed。
- Evaluation Dashboard：支持 quick / standard / full 评测、失败分桶、历史记录、趋势图和报告导出。
- Chat Run History：支持保存单次 Agent 运行、查看 Trace、导出 Markdown / JSON 报告。
- Trace Export：Router、RAG、Tools、Retriever、LLM、fallback 信息可用于运行复盘和问题排查。
- Chat Workspace：会话侧边栏、标题搜索与重命名、连续消息流、固定 Composer、移动抽屉和消息级回答详情。
- Conversation Context Manager：服务端对候选历史执行统一的 Token Budget、最近 4 个完整 turn 保留、最多 2 个规则式相关历史选择与最终裁剪。
- Rolling Summary：达到 8 个完整 turn 后，保护最近 4 个 turn，以 cursor 增量压缩较早完整历史；摘要作为不可信历史资料，不改变 System Prompt 优先级。
- Revision & Streaming Safety：Regenerate、Edit & Resend、Stop、CAS 和 Conversation epoch 继续隔离陈旧结果；Summary Patch 只在正常完成时原子持久化，不进入 Ops、Trace 或 assistant details。
- 服务端存储：Prisma 6.19.3 + PostgreSQL 持久化 Conversation、Message、Conversation Summary、KnowledgePack、KnowledgeDocument、KnowledgeChunk、ImportJob、ImportItem 与迁移状态。
- Repository 适配：Conversation 与 Knowledge 均提供 Local / Server Repository；UI 依赖统一接口，不直接拼接数据库操作。
- 匿名工作区隔离：服务端签发 HttpOnly、SameSite=Lax 的不透明工作区 Cookie，生产环境启用 Secure；客户端提交的 `workspaceId` 不作为授权依据。
- 平滑迁移：迁移前预检并要求用户确认，以幂等 `migrationId` 导入本地会话、消息、摘要和知识文档；服务器已有记录优先，原 localStorage 数据保留作为回滚备份。
- 存储模式：`local` 保持 V2.1.0 本地行为；`server` 以服务端为数据源；`degraded` 可展示浏览器中已有的本地兼容数据（如有），但阻止伪装成功的本地写入。

## 页面说明

- `/about`：项目说明、架构能力、版本能力和工程亮点。
- `/chat`：连续多轮聊天工作台，支持会话管理、Real API-first、开发模拟模式、RAG 来源、工具调用、消息级 Trace / Feedback 和运行历史。
- `/knowledge`：知识库管理与用户文档导入；server 模式支持企业知识包、批量文件预览、元数据编辑、冲突处理、任务进度、失败重试、chunks 和质量诊断。
- `/evaluation`：Agent 评测面板，支持 80 条 Mock full 评测、历史记录、趋势图和 Markdown / JSON 报告。
- `/tools`：业务工具工作台，按业务场景展示订单查询、规则检索、工单创建和客服回复等能力。
- `/scenarios`：企业知识库、电商售后与 AI 工程规范等当前活动场景说明。

## 推荐体验路径

建议按下面顺序体验完整产品链路：

1. 先看 `/knowledge`：了解默认知识库；server 模式下创建企业知识包，选择多个小型 TXT / Markdown / PDF / DOCX 文件，检查预览、重复状态、chunks 和质量诊断后确认导入。
2. 再看 `/chat`：输入业务问题，观察 Agent Router、Hybrid RAG、业务工具、Real API / 兜底状态和 Trace。
3. 再看 `/tools`：查看订单、规则、工单和客服回复等工具如何支撑业务流程。
4. 再看 `/evaluation`：运行 full Mock 评测，查看 80/80 指标、趋势和报告导出。
5. 最后看 `/about` 与 `docs/`：了解架构边界、版本能力和后续升级方向。

## 推荐测试问题

- 订单10001能不能退？
- 东西不喜欢想退咋办
- 模型输出不是合法 JSON 怎么处理
- 我出差回来想报销，应该准备哪些材料？
- 公司笔记本电脑申请制度适用于哪些人？

其中最后一个问题适合配合 `/knowledge` 用户文档导入测试：先导入一篇“公司笔记本电脑申请制度”，刷新页面后再到 `/chat` 提问，预期 sources 中优先出现用户上传文档。

## 存储模式与知识库导入

- 未启用服务端存储时，用户会话和知识文档继续使用原 localStorage key，V2.0.4 / V2.1.0 数据无需清空即可读取。
- 服务端存储健康时，企业知识包、导入任务、用户知识文档及其 chunks 保存在当前匿名工作区的 PostgreSQL 数据中，RAG 只读取该工作区已启用的文档。
- 数据库已配置但不可用时，界面显示 degraded 状态；可以展示浏览器中已有的本地兼容数据（如有），写入会明确失败并提示重试，不会静默保存到 localStorage。
- 从 localStorage 迁移前会预检并请求确认。重复提交使用相同迁移标识时不会重复导入；ID 相同且内容不一致会报告冲突，服务器记录不会被自动覆盖。
- 迁移成功后只写入迁移状态标记，原 localStorage 会话和知识文档不会被删除。
- local 模式保留原有单文档本地导入；企业知识包与批量任务需要 server 模式。degraded 模式不会启动或推进正式任务。
- 批量导入支持 TXT、Markdown、文本型 PDF 和 DOCX；单批最多 10 个文件、单文件 5 MiB、单批 25 MiB。原始文件不长期保存，不接入对象存储，不支持 OCR。

## 本地运行方式

```bash
npm install
npm run dev
```

打开：`http://localhost:3000`

构建验证：

```bash
npm run typecheck
npm run build
```

数据库未配置时应用自动使用 local 模式。需要验证服务端存储时，请使用独立的 PostgreSQL 数据库，并参考 `docs/server-storage-local-development.md`；不要把生产连接串提交到仓库，也不要执行数据库 reset。

数据库相关脚本：

```bash
npm run db:generate
npm run db:validate
npm run db:migrate:dev
npm run db:migrate:deploy
npm run db:status
npm run test:storage
npm run test:storage:postgres
npm run test:migration:v221
npm run test:migration:v222
npm run test:knowledge-import
npm run test:real-api:node20
npm run test:import:hardening
npm run test:import:stress
npm run production:check
```

## Real API 配置

V1.9 起，`/chat` 在模型服务已配置时默认使用 Real API 生成回答；未配置模型服务时自动进入开发模拟模式。Real API 模式需要在本地创建 `.env.local`，并由服务端 API Route 读取。如果请求失败，页面会明确显示 `real_error_fallback` 或等价兜底提示，不会把兜底回答伪装成真实模型成功。

示例 `.env.example`：

```env
AI_API_KEY=your_api_key_here
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
AI_PROVIDER=deepseek

DATABASE_URL=postgresql://user:password@localhost:5432/enterprise_agent_hub
SERVER_STORAGE_ENABLED=false
STORAGE_SESSION_SECRET=replace_with_at_least_32_random_characters

HTTPS_PROXY=
HTTP_PROXY=
ALL_PROXY=
AI_REQUEST_TIMEOUT_MS=20000
```

安全要求：

- 不要提交 `.env.local`。
- 不要把真实 API Key 写入代码、README 或 docs。
- API Key 只在服务端读取，浏览器端不暴露完整 Key。
- 部署到 Vercel 时，请在 Project Settings 的 Environment Variables 中配置 Key。
Real API 线上不可用时，请检查：

- Vercel 是否配置 `AI_API_KEY`。
- `AI_BASE_URL` 是否正确。
- `AI_MODEL` 是否为当前账号可用的模型。
- `AI_PROVIDER` 是否匹配当前 OpenAI-compatible 服务。
- 修改环境变量后是否已经重新部署。
- 不要配置本地代理地址，例如 `127.0.0.1:7897`。

如果上游返回 403，通常表示 Key、模型权限、账户额度或模型名称配置存在问题；此时 `/chat` 会明确显示 Real API 失败，并使用系统兜底回答，不会伪装成真实模型生成成功。

## 当前评测结果

当前 Mock full 评测结果：

- total: 80
- passed: 80
- passRate: 100%
- scenarioAccuracy: 100%
- intentAccuracy: 100%
- toolHitRate: 100%
- ragUsageAccuracy: 100%
- citationRate: 100%
- keywordHitRate: 100%

Real API 模式可用于验证真实模型结构化输出稳定性，但会消耗 API 额度，因此默认评测使用 Mock 模式。

## 当前边界

- 默认业务数据和知识库内容主要为自建 mock 数据，不是真实企业数据。
- PostgreSQL 服务端存储是可选能力；未配置时仍使用浏览器 localStorage。
- 当前匿名 HttpOnly Cookie 只提供浏览器级工作区隔离，不包含完整登录、账号找回、角色权限或正式企业组织架构。
- Mock Embedding Retriever 是本地 deterministic 模拟，不等于真实语义向量或生产级向量库。
- 当前没有对象存储、OCR、向量数据库、长期记忆、跨会话记忆或用户画像。
- Tool Calling 是本地规则编排，不是模型原生 `tool_calls`。
- PDF 仅支持可直接提取文字的文本型文件；扫描版/图片型 PDF 不做 OCR。DOCX 只提取受限文本，不执行宏、嵌入对象或外部链接。
- 当前 Git 版本尚未更新腾讯云应用，线上应用仍保持 V2.0.4。

## 后续规划

- 用户反馈升级：将当前浏览器本地反馈统计升级为服务端反馈记录、标注审核和运营看板。
- 竞品分析与 PRD 完善：补充企业知识库 Agent / 客服 Agent 的产品需求文档。
- 真实向量数据库接入：接入 Embedding + pgvector / Qdrant / Chroma。
- 企业工作区与用户体系：增加账号登录、跨浏览器恢复、组织角色、操作日志和合规审计。
- 对象存储与 OCR：支持大文件原件、图片文字识别和扫描文档异步处理；不混入当前受限文本导入链路。

## 文档入口

- `docs/architecture.md`：系统架构、RAG、Agent Router、Tool Calling、Real API、fallback 和持久化边界。
- `docs/server-storage-design.md`：V2.2.0 PostgreSQL Schema、Repository、工作区隔离、事务与安全边界。
- `docs/knowledge-import-architecture.md`：V2.2.1 企业知识包、持久化任务、事务、并发与 Repository 架构。
- `docs/knowledge-import-limits.md`：支持格式、文件限制、分块质量、重复检测与冲突规则。
- `docs/v2.2.1-database-migration.md`：从 V2.2.0 升级与全新 PostgreSQL 16 migration 验证、回滚边界。
- `docs/v2.2.2-production-hardening.md`：Node 20 依赖、Real API、资源限制、claim/lease、压力测试和生产启动检查。
- `docs/v2.2.2-database-operations.md`：PostgreSQL 备份、迁移失败、恢复、Canary、PM2 和应用回滚检查。
- `docs/server-storage-local-development.md`：本地 PostgreSQL 配置、Prisma 命令和三种存储模式验证。
- `docs/local-storage-migration.md`：localStorage 迁移预检、幂等、冲突与回滚说明。
- `docs/server-storage-deployment-prerequisites.md`：未来部署服务端存储前必须完成的数据库、Secret、迁移与回滚检查。
- `docs/v2.2.0-release-notes.md`：V2.2.0 服务端存储与持久化发布说明。
- `docs/v2.2.1-release-notes.md`：V2.2.1 企业知识包与导入流程发布说明。
- `docs/v2.2.2-release-notes.md`：V2.2.2 依赖兼容与生产导入加固发布说明。
- `docs/evaluation.md`：评测集设计、指标说明、Mock full 结果、历史记录和趋势图。
- `docs/v1.9-release-candidate.md`：V1.9 当前能力摘要、体验路径和应用边界。
- `docs/resume-bullets.md`：早期项目介绍素材，非当前产品主线文档。
- `docs/interview-guide.md`：早期讲解素材，非当前产品主线文档。
- `docs/release-checklist.md`：GitHub / Vercel 发布前检查清单。
