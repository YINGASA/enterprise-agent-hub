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
- Trace Export：Router、RAG、Tools、Retriever、LLM、fallback 信息可用于运行复盘和问题排查。

## 页面说明

- `/about`：项目说明、架构能力、版本能力和工程亮点。
- `/chat`：Agent 问答工作台，支持 Real API-first、开发模拟模式、RAG 来源、工具调用、Trace 和运行历史。
- `/knowledge`：知识库管理与用户文档导入，支持粘贴、文件导入、搜索、筛选、启用/禁用、chunks、测试问题和质量诊断。
- `/evaluation`：Agent 评测面板，支持 80 条 Mock full 评测、历史记录、趋势图和 Markdown / JSON 报告。
- `/tools`：业务工具工作台，按业务场景展示订单查询、规则检索、工单创建、JD 匹配等能力。
- `/scenarios`：企业知识库、电商售后、招聘求职等场景模板说明。

## 推荐体验路径

建议按下面顺序体验完整产品链路：

1. 先看 `/knowledge`：了解默认知识库、导入本地文档，检查启用状态、chunks、标签和质量诊断。
2. 再看 `/chat`：输入业务问题，观察 Agent Router、Hybrid RAG、业务工具、Real API / 兜底状态和 Trace。
3. 再看 `/tools`：查看订单、规则、工单、JD 匹配等工具如何支撑业务流程。
4. 再看 `/evaluation`：运行 full Mock 评测，查看 80/80 指标、趋势和报告导出。
5. 最后看 `/about` 与 `docs/`：了解架构边界、版本能力和后续升级方向。

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
- 文件默认保存在浏览器 localStorage，不使用数据库或对象存储；发起聊天时，启用文档会发送到本应用服务端参与检索，Real 模式下仅相关命中片段可能发送给配置的模型服务。

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

V1.9 起，`/chat` 在模型服务已配置时默认使用 Real API 生成回答；未配置模型服务时自动进入开发模拟模式。Real API 模式需要在本地创建 `.env.local`，并由服务端 API Route 读取。如果请求失败，页面会明确显示 `real_error_fallback` 或等价兜底提示，不会把兜底回答伪装成真实模型成功。

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
- 用户导入文档保存在浏览器 localStorage，不是服务端知识库。
- Mock Embedding Retriever 是本地 deterministic 模拟，不等于真实语义向量或生产级向量库。
- 当前没有数据库、权限系统、团队空间、审计日志或服务端长期记忆。
- Tool Calling 是本地规则编排，不是模型原生 `tool_calls`。
- 当前不支持 PDF / DOCX / OCR 等复杂文件解析。

## 后续规划

- 多轮对话重新设计：在不牺牲主体验的前提下重做会话和上下文记忆。
- 用户反馈升级：将当前浏览器本地反馈统计升级为服务端反馈记录、标注审核和运营看板。
- 竞品分析与 PRD 完善：补充企业知识库 Agent / 客服 Agent 的产品需求文档。
- 真实向量数据库接入：接入 Embedding + pgvector / Qdrant / Chroma。
- 团队权限与审计日志：支持企业空间、用户角色、操作日志和合规审计。
- 服务端知识库：将 localStorage 文档升级为数据库 / 对象存储 / 文档解析流水线。

## 文档入口

- `docs/architecture.md`：系统架构、RAG、Agent Router、Tool Calling、Real API、fallback 和持久化边界。
- `docs/evaluation.md`：评测集设计、指标说明、Mock full 结果、历史记录和趋势图。
- `docs/v1.9-release-candidate.md`：V1.9 当前能力摘要、体验路径和应用边界。
- `docs/resume-bullets.md`：早期项目介绍素材，非当前产品主线文档。
- `docs/interview-guide.md`：早期讲解素材，非当前产品主线文档。
- `docs/release-checklist.md`：GitHub / Vercel 发布前检查清单。
