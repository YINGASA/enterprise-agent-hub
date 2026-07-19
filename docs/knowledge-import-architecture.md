# V2.2.x 企业知识包与导入架构

## 1. 目标与边界

V2.2.1 在 V2.2.0 的 PostgreSQL 知识存储上增加企业知识包、多文件导入预览、重复检测、冲突处理、持久化导入任务、失败重试和分块质量诊断。浏览器只负责选择文件、编辑安全元数据和驱动有限步骤；服务端负责工作区鉴权、文件解析、最终校验、任务状态和文档事务写入。

V2.2.2 不改变上述产品流程，重点收紧 Node 20 运行兼容、解析与请求时限、claim/lease 恢复、最大重试和 PostgreSQL 查询索引。

本版本不保存原始上传文件，不接入对象存储，不执行 OCR，不解析图片或扫描版 PDF 中的文字，也不执行文档宏、脚本或外部链接。

## 2. 完整调用链

```text
文件选择
→ 客户端数量、大小、扩展名与 MIME 基础校验
→ POST /api/storage/knowledge/import/preview
→ 同源检查与服务端 Workspace Cookie 解析
→ 文件签名、实际结构与安全限制校验
→ TXT / Markdown / PDF / DOCX 文本提取
→ 原始字节 checksum 幂等预检
→ 正文规范化、工作区既有文档与同批文件重复检测
→ 复用生产 RAG 分块器生成分块预览和质量诊断
→ 持久化 preview_ready ImportJob / ImportItem
→ 用户编辑元数据并选择 skip / replace / import_as_new
→ 确认任务
→ 客户端逐次调用 process，服务端 claim / lease 单项处理
→ 单个 KnowledgeDocument 与 KnowledgeChunk 在同一事务写入
→ 汇总 completed / partial_failed / failed / cancelled
```

预览阶段不会创建正式 `KnowledgeDocument` 或 `KnowledgeChunk`。原始文件只在受限请求处理期间存在于内存；数据库仅保存受限的提取文本、预览元数据、分块预览、checksum 和任务结果。成功项写入正式文档后，不依赖原始文件继续运行。

## 3. PostgreSQL 模型

### KnowledgePack

- 复合主键：`(workspaceId, id)`。
- 同一工作区使用规范化名称唯一约束。
- 字段包括名称、可选说明、状态、revision 和时间戳。
- `documentCount` 由限定工作区的可靠查询计算，不保存易漂移的冗余计数。
- 默认删除知识包时，事务内把文档的 `knowledgePackId` 置空并保留文档；需要同时删除文档时必须传入明确确认值。

`KnowledgeDocument.packId` 继续表示现有内置 RAG 分类；V2.2.1 新增的 `knowledgePackId` 表示工作区拥有的企业知识包，二者不能混用。

### ImportJob

任务保存知识包归属、状态、总数与成功/失败/跳过/冲突计数、revision、完成时间、安全错误码和耗时。支持：

- `pending`
- `preview_ready`
- `processing`
- `completed`
- `partial_failed`
- `failed`
- `cancelled`

V2.2.0 已存在的单文档 `running` 记录继续可读；迁移不会删除旧任务。

### ImportItem

每个文件对应一个持久化项，保存文件名、规范化标题、MIME、大小、checksum、预览元数据、受限分块预览、冲突信息、结果文档 ID、重试次数、revision 和 claim/lease 字段。错误只保存安全枚举和中文安全文案，不保存堆栈、本机路径或数据库信息。

### KnowledgeDocument / KnowledgeChunk

文档新增 `knowledgePackId`、`contentChecksum`、`originalFileName`、`mimeType`、`sizeBytes`、`importJobId` 和 revision。文档与 chunks 的创建或替换在同一事务内完成；替换会删除旧 chunks 后按同一生产分块逻辑重建。

## 4. Repository 与运行模式

```text
Knowledge UI
├─ KnowledgePackRepository
│  └─ ServerKnowledgePackRepository → /api/storage/knowledge/packs
├─ KnowledgeImportRepository
│  └─ ServerKnowledgeImportRepository → /api/storage/knowledge/import
└─ KnowledgeRepository
   ├─ LocalKnowledgeRepository
   └─ ServerKnowledgeRepository
```

- `local`：保留 V2.2.0 单文档本地导入和本地 RAG；企业知识包与批量任务明确提示需要服务端存储。
- `server`：知识包、任务、文档和 chunks 以当前 PostgreSQL 工作区为正式数据源。
- `degraded`：可显示已加载内容，但不能创建或推进正式导入任务，也不会静默写回 localStorage 假装成功。

页面刷新后，客户端优先通过 `sessionStorage` 中仅含任务 ID 的短期指针重新请求服务端任务；指针缺失、失效或只指向旧的已完成结果时，会从当前 Workspace 最近 10 个可恢复任务中发现最新任务。任务和结果本身不依赖 React state 或浏览器长期正文缓存。

## 5. 并发、幂等与失败边界

- 所有查询和写入都附带服务端解析的 `workspaceId`；客户端传入的 `workspaceId` 不作为授权依据。
- 每个预览批次由客户端生成并在重试时复用幂等键；服务端在解析前用文件名、原始字节 checksum 和知识包校验重放，避免重复解析与重复建任务。
- 知识包修改、任务确认、处理、重试和取消使用 revision/CAS；冲突返回 409，不部分写入。
- `process` 每次最多 claim 一个项目，并使用随机 claim token、30 秒租约、10 秒续租间隔和条件更新防止两个处理器重复消费；过期 lease 可由新处理器恢复，旧 token 不能提交结果。
- 已成功项不会因任务重试再次导入；保留了安全提取正文的处理失败项可独立回到待处理状态并增加 retryCount。解析失败项因原始文件不持久保存，需要用户重新选择文件生成预览。
- 单个文件失败不会回滚其他已经成功的文件；单个文档与其 chunks 要么全部提交，要么全部回滚。
- `replace` 只允许替换同一工作区、预览时明确命中的文档，并复核目标 revision；不会跨工作区覆盖。
- `cancel` 停止尚未完成的项目并清除不再可处理的临时提取正文，不删除已经成功导入的独立文档。
- 已归档知识包不能接收新的预览或确认；已经确认的任务可以完成，避免归档竞态造成半完成导入。
- 每个 Workspace 最多保留 20 个活动任务和 50 个带临时提取正文的项目；超过 24 小时的未确认预览会被删除，其他过期临时正文会在读取、恢复、处理、重试或新预览前清理。仍依赖正文的 Item 转为安全失败、清除 claim/lease 并事务重算任务统计，终态只清正文；正式 KnowledgeDocument/Chunk 不受影响。单批解析并发固定为 2；单服务进程同时最多 2 个预览、同一 Workspace 最多 1 个预览。
- 单文件解析、预览请求、单项处理和处理会话分别限制为 10、60、20 和 90 秒；可恢复失败项最多重试 3 次。
- 进程级预览并发阈值在 `finally` 中释放并覆盖成功、失败和取消路径；多 PM2 worker / 多容器部署仍必须在 Nginx 或 API 网关配置分布式限速与总并发上限。
- `partial_failed` / `failed` 中仍可重试的任务会阻止删除其引用的知识包；取消任务后才可删除，避免重试时引用失效。

## 6. 隐私与日志

API 响应默认不返回完整提取正文或完整 checksum。Ops 只记录知识包、任务、项目、成功、失败、冲突、重试、平均耗时，以及白名单化的 parser/duplicate 分布；不记录原始文件、正文、完整路径、Cookie、DATABASE_URL、Prompt、Summary 或 Secret。
