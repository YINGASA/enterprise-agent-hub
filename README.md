# Enterprise Agent Hub

面向企业知识库与业务流程自动化的 AI Agent 产品原型。

Enterprise Agent Hub 用于展示一个企业 AI Agent 从产品设计到工程实现的完整闭环：用户提出业务问题后，系统通过 Agent Router 判断场景与意图，结合 Hybrid RAG 检索、业务工具调用、Mock / Real API 双模式、结构化输出、fallback、评测面板和运行追踪，形成可解释、可评估、可复盘的 AI 应用体验。

## 项目定位

这是一个 AI 产品原型，不是单纯的 API 调用 Demo。项目重点展示企业 AI Agent 在以下环节中的设计和实现能力：

- 知识库问答：默认 Knowledge Packs + 用户本地导入文档共同参与 RAG。
- 业务工具调用：订单、商品、规则、工单、JD 分析等本地工具可编排。
- 评测验证：内置 80 条多场景 Mock 评测用例，支持历史记录、趋势和报告导出。
- 运行追踪：Chat 侧可保存单次 Agent Run，导出 Router / RAG / Tools / LLM / Retriever Trace。
- 真实模型接入：支持 OpenAI-compatible / DeepSeek Real API，失败时 fallback 到 mock-agent。

## 核心场景

- 企业知识库问答：报销、差旅、请假、IT 权限、数据安全、设备申请等。
- 电商客服售后：订单查询、退货退款、售后规则、物流异常、客服回复。
- 招聘 JD 匹配：岗位要求、简历关键词、候选人评分、项目匹配建议。
- AI 工程规范问答：JSON repair、fallback、RAG 引用、Tool Calling、评测集设计。

## 核心能力

- Agent Router：规则版场景与意图识别，支持 enterprise / ecommerce / recruitment / ai_engineering / general。
- Hybrid RAG：关键词、标题、标签、分类、知识包、来源、业务短语、时效等多维评分。
- Retriever Adapter：封装 Hybrid Retriever，并预留 Mock Embedding / Auto 检索策略接口。
- Tool Calling：本地工具编排，覆盖订单、商品、规则检索、工单、JD 分析和客服回复。
- Mock / Real API 双模式：Mock 默认可用，Real API 通过服务端 API Route 调用模型。
- Knowledge Import：支持 txt / md / json / csv 本地导入和粘贴文本导入。
- Evaluation Dashboard：支持 quick / standard / full 评测、失败分桶、历史记录、趋势图和报告导出。
- Chat Run History：支持保存单次 Agent 运行、查看 Trace、导出 Markdown / JSON 报告。
- Trace Export：Router、RAG、Tools、Retriever、LLM、fallback 信息可用于复盘和面试讲解。

## 页面说明

- `/about`：项目说明、架构能力、版本能力和工程亮点。
- `/chat`：Agent 问答工作台，支持 Mock / Real API、RAG 来源、工具调用、Trace 和运行历史。
- `/knowledge`：知识库管理与用户文档导入，支持粘贴、文件导入、搜索、筛选、chunks 查看和删除。
- `/evaluation`：Agent 评测面板，支持 80 条 Mock full 评测、历史记录、趋势图和 Markdown / JSON 报告。
- `/tools`：业务工具演示中心，可直接运行本地工具示例。
- `/scenarios`：企业知识库、电商售后、招聘求职等场景模板说明。

## 推荐评估路径

建议面试方按下面顺序体验项目：

1. 先看 `/about`：了解项目定位、架构和当前能力边界。
2. 再看 `/chat`：体验 Agent Router、Hybrid RAG、Tool Calling、Real / Mock 双模式和 Trace。
3. 再看 `/knowledge`：导入一个本地文档，刷新页面确认仍保留，并在 Chat 中检索。
4. 再看 `/evaluation`：运行 full Mock 评测，查看 80/80 指标、趋势和报告导出。
5. 最后看 `docs/`：阅读架构、评测设计、简历 bullet 和面试讲解稿。

## 推荐测试问题

- 订单10001能不能退？
- 东西不喜欢想退咋办
- 模型输出不是合法 JSON 怎么处理
- 我出差回来想报销，应该准备哪些材料？
- 公司笔记本电脑申请制度适用于哪些人？

其中最后一个问题适合配合 `/knowledge` 用户文档导入测试：先导入一篇“公司笔记本电脑申请制度”，刷新页面后再到 `/chat` 提问，预期 sources 中优先出现用户上传文档。

## 知识库导入说明

V1.6.1 修复并强化了用户导入文档的浏览器本地持久化：

- 用户导入文档会保存到当前浏览器 `localStorage`。
- 刷新 `/knowledge` 后，用户上传和粘贴的文档仍会保留。
- 删除单个用户文档会同步更新 `localStorage`。
- 清空用户文档只会清空用户导入内容，不会影响系统内置默认知识库。
- `/chat` 会读取同一份用户文档，并把它们传给 Agent Pipeline 参与 RAG 检索。
- 线上演示中，不同浏览器、不同设备、不同域名之间不会共享用户导入文档。
- 当前不上传文件到服务器，也不使用数据库或对象存储。

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

## Real API 配置

默认 Mock 模式不需要 API Key，可以直接体验。Real API 模式需要在本地创建 `.env.local`，并由服务端 API Route 读取。

示例 `.env.example`：

```env
AI_API_KEY=your_api_key_here
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
AI_PROVIDER=deepseek

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
- 用户导入文档保存在浏览器 localStorage，不是服务端知识库。
- Mock Embedding Retriever 是本地 deterministic 模拟，不等于真实语义向量或生产级向量库。
- 当前没有数据库、权限系统、团队空间、审计日志或服务端长期记忆。
- Tool Calling 是本地规则编排，不是模型原生 `tool_calls`。
- 当前不支持 PDF / DOCX / OCR 等复杂文件解析。

## 后续规划

- 多轮对话重新设计：在不牺牲主体验的前提下重做会话和上下文记忆。
- 用户反馈闭环：对回答质量、来源可信度、工具调用结果进行用户反馈采集。
- 竞品分析与 PRD 完善：补充企业知识库 Agent / 客服 Agent 的产品需求文档。
- 真实向量数据库接入：接入 Embedding + pgvector / Qdrant / Chroma。
- 团队权限与审计日志：支持企业空间、用户角色、操作日志和合规审计。
- 服务端知识库：将 localStorage 文档升级为数据库 / 对象存储 / 文档解析流水线。

## 文档入口

- `docs/architecture.md`：系统架构、RAG、Agent Router、Tool Calling、Real API、fallback 和持久化边界。
- `docs/evaluation.md`：评测集设计、指标说明、Mock full 结果、历史记录和趋势图。
- `docs/resume-bullets.md`：简历 bullet 与项目介绍版本。
- `docs/interview-guide.md`：面试讲解思路与常见追问回答。
- `docs/release-checklist.md`：GitHub / Vercel 发布前检查清单。
