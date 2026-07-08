# Resume Bullets

## 最终简历推荐版

- 基于 Next.js + TypeScript 构建 Enterprise Agent Hub 企业级 AI Agent 平台，覆盖企业制度、电商客服售后、招聘求职、AI 工程规范四类知识库场景。
- 设计 RAG + Agent Router + Tool Calling 编排流程，实现意图识别、关键词知识库检索、本地业务工具调用、来源引用和结构化 JSON 输出。
- 接入 OpenAI-compatible API / DeepSeek，支持 Mock / Real 双模式、服务端 Key 管理、JSON repair、文本兜底和网络 fallback，提升演示稳定性。
- 构建 Agent Evaluation Dashboard，覆盖 50 条多场景测试用例，统计场景识别、意图识别、工具命中、RAG 引用、关键词命中和 fallback 等指标，Mock 完整评测通过率 100%。

## 精简版

- 设计并实现 Enterprise Agent Hub，一个基于 Next.js + TypeScript 的企业级 AI Agent 平台原型，覆盖 RAG 知识库问答、Agent Router、Tool Calling、结构化 JSON 输出和评测面板。
- 构建 Mock / Real 双模式 Agent Pipeline，支持 OpenAI-compatible API / DeepSeek 接入、JSON parse repair、fallback 机制和服务端代理诊断，保证演示稳定性。
- 设计 15 条内置评测集与 Agent Evaluation Dashboard，统计场景识别、意图识别、工具命中、RAG 引用、关键词命中和 fallback 率，Mock 全量评测通过率达到 100%。

## 详细版

- 从 0 搭建 Enterprise Agent Hub：企业知识库与业务流程自动化 Agent 平台，使用 Next.js App Router、TypeScript、Tailwind CSS 实现 B 端 SaaS 风格前端和服务端 API Routes。
- 实现本地规则版 Agent Router，根据用户问题自动识别 enterprise / ecommerce / recruitment / general 场景与知识问答、售后政策、订单查询、商品查询、JD 匹配、工单创建等意图。
- 实现 mock RAG 流程：文档录入、文本切片、关键词提取、TopK 召回、来源引用和 mock 回答，为后续接入 Embedding 与向量数据库预留边界。
- 实现本地 Tool Calling 层：订单查询、商品查询、政策检索、工单创建、JD 分析、客服回复生成，并在 Agent Trace 中展示每一步输入、输出和耗时。
- 接入 OpenAI-compatible Chat Completions，兼容 DeepSeek；API Key 仅在服务端读取，支持 Mock / Real 双模式、代理诊断、请求超时和连接健康检查。
- 设计结构化输出与容错链路：要求模型返回 AgentResponse JSON，解析失败后进行一次 JSON repair，仍失败时使用真实文本回答和 fallback structured output。
- 构建 Agent Evaluation Dashboard，内置 80 条多场景 Mock 回归用例，统计 passRate、scenarioAccuracy、intentAccuracy、toolHitRate、ragUsageAccuracy、citationRate、keywordHitRate、fallbackRate，并提供失败原因分桶分析。

## 项目关键词

RAG, Agent Router, Tool Calling, OpenAI-compatible API, DeepSeek, JSON structured output, fallback, Evaluation Dashboard, Next.js, TypeScript, Tailwind CSS.
