# Interview Guide

## 1. 项目背景怎么讲

Enterprise Agent Hub 是一个面向 AI 应用开发工程师岗位的企业级 Agent 平台原型。它不是只做一个聊天框，而是把企业 AI 应用常见的链路串起来：知识库检索、Agent Router、业务工具调用、真实模型接入、结构化输出、fallback 和评测面板。

## 2. 技术难点

- 如何把用户问题路由到正确业务场景。
- 如何把 RAG、工具调用和 LLM 结果组合成可解释的 Agent Trace。
- 如何让真实模型输出稳定落到结构化 JSON。
- 如何在 API Key 缺失、网络失败、JSON 解析失败时仍保持演示可用。
- 如何设计评测集，让项目质量不是凭感觉判断。

## 3. 为什么做 Mock / Real 双模式

Mock 模式保证稳定演示和低成本验证，适合开发、面试和 CI 式检查。Real 模式用于验证真实模型回答质量和结构化输出稳定性。两者共用同一条 Agent Pipeline，所以不是两套割裂逻辑。

## 4. 为什么做 fallback

真实模型应用的不确定性来自网络、鉴权、限流、模型输出格式、JSON 截断等问题。fallback 机制可以让业务系统在失败时仍返回可解释结果，并把失败原因暴露给前端和评测面板。

## 5. 为什么做评测面板

企业 AI 应用不能只看单次回答。评测面板可以持续追踪 Router 准确率、工具命中率、RAG 引用率、关键词命中率、fallback 率和平均耗时。这样每次改规则或 Prompt 都能看到质量变化。

## 6. 面试官问：这是不是只调 API？

不是。真实 LLM 只是最后的生成层。项目里还包含：

- 本地 Agent Router
- mock RAG 检索与来源引用
- 本地业务工具层
- 多步骤 Agent Trace
- JSON parse / repair / fallback
- LLM 连接诊断与代理支持
- Evaluation Dashboard

这些是 AI 应用工程化中比单次 API 调用更重要的部分。

## 7. 面试官问：RAG 现在是不是假的向量库？

是的，当前版本刻意使用 keyword retrieval mock RAG，没有宣称是真实向量库。这样做的目的是先把文档、chunk、检索、引用、回答和评测链路跑通。后续可以把 `retrieveChunks` 替换为 Embedding + pgvector / Qdrant + Rerank，而页面和评测层不需要大改。

## 8. 面试官问：Tool Calling 是不是模型原生 tool_calls？

当前不是模型原生 tool_calls，而是服务端根据 Router 规则做本地工具编排。这样便于展示工具输入输出、错误处理和评测。下一步可以让模型输出 tool call JSON 或使用原生 tool_calls，再复用现有工具层执行。

## 9. 后续怎么升级

- 接入真实文件上传和解析。
- 接入 Embedding 和向量数据库。
- 增加 Rerank 和引用质量评分。
- 接入模型原生 Tool Calls。
- 增加评测历史趋势和版本对比。
- 增加用户权限、审计日志和生产监控。

## 10. 一分钟项目介绍

我做了一个 Enterprise Agent Hub，用 Next.js 和 TypeScript 搭了一个企业级 Agent 平台原型。它聚焦企业知识库问答、制度与流程查询、电商客服售后和业务流程工具编排。用户输入后，系统会先用 Agent Router 判断场景和意图，再决定是否走 RAG、调用哪些业务工具，最后可以用 DeepSeek 这类 OpenAI-compatible 模型生成结构化 JSON。如果模型 JSON 不稳定，会做一次 repair，再失败就用真实文本兜底。项目还内置了 80 条评测集和 Evaluation Dashboard，用来统计路由准确率、工具命中率、RAG 引用率、关键词命中率和 fallback 率。这个项目重点展示的是 AI 应用工程化闭环，而不是单纯调一次模型 API。
