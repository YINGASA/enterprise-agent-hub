import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { appVersionLabel, buildCommit } from "@/lib/appVersion";

const capabilities = [
  "4 个系统内置 Knowledge Packs，覆盖企业制度、电商售后、招聘匹配和 AI 工程规范",
  "本地知识库导入，支持 txt / md / json / csv，并保存在浏览器 localStorage",
  "Pack-aware Hybrid RAG，支持 Query Expansion、多维评分、scoreBreakdown 和 retrievalConfidence",
  "Agent Router 识别业务场景与任务意图，统一编排 RAG、Tools、LLM 与 fallback",
  "OpenAI-compatible Real API 接入，服务端管理模型服务配置，前端不暴露密钥或工程细节",
  "80 条多场景 Agent Evaluation Suite，支持历史记录、趋势摘要和 Markdown / JSON 报告导出",
  "Knowledge RAG 应用化能力：用户文档启用/禁用、引用透明化、回答反馈和知识库质量诊断",
  "服务端运行摘要：记录 Agent 调用、Chat 反馈和 full Mock 评测摘要，支持 /ops 轻量观测",
];

const productProblems = [
  "企业制度、客服政策和项目知识分散在不同文档里，员工很难快速找到可信答案。",
  "业务问答不仅要回答，还要说明依据、边界和下一步动作，避免 AI 编造结论。",
  "真实模型接入后，需要保留 Mock 回归、Trace 和评测面板，持续验证 Agent 链路质量。",
];

const coreScenarios = [
  { title: "企业制度问答", body: "报销、差旅、请假、权限、采购和数据安全等内部制度咨询。" },
  { title: "电商客服售后", body: "订单退换、质量问题、物流异常、投诉升级和客服话术辅助。" },
  { title: "招聘 JD 匹配", body: "候选人能力、项目经历、岗位要求和面试跟进建议。" },
  { title: "AI 工程规范", body: "RAG、Tool Calling、JSON repair、fallback、评测集和部署检查。" },
];

const versions = [
  { version: "V0.1", title: "项目骨架", body: "完成 7 个基础页面、统一导航和 B 端 SaaS 风格界面。" },
  { version: "V0.2", title: "业务工具层", body: "新增 mock 数据，并实现订单查询、商品查询、规则检索、工单创建、JD 分析和客服回复生成等本地工具。" },
  { version: "V0.3", title: "基础 Mock RAG", body: "跑通文档切片、关键词提取、TopK 检索、来源引用和 mock 回答链路。" },
  { version: "V0.4", title: "Agent Router", body: "实现规则版 Router，根据问题判断场景、意图、是否需要 RAG 和需要调用的业务工具。" },
  { version: "V0.5", title: "Real API 接入", body: "接入 OpenAI-compatible API，兼容 DeepSeek，支持 Mock / Real 双模式、JSON parse、repair 和 fallback。" },
  { version: "V0.6", title: "评测面板", body: "新增 Agent Evaluation Dashboard，统计场景识别、意图识别、工具命中、RAG 引用、关键词命中和 fallback 指标。" },
  { version: "V0.7", title: "文档与发布准备", body: "完善 README、架构文档、评测文档、截图清单和发布检查清单。" },
  { version: "V0.8", title: "GitHub / Vercel 发布准备", body: "完成发布前安全检查、截图说明、部署说明和 release checklist。" },
  { version: "V0.9", title: "知识库扩容与自由提问", body: "扩充默认 Knowledge Packs，优化自由提问体验、Top sources 展示和评测用例覆盖。" },
  { version: "V1.0", title: "本地知识库导入", body: "支持 txt / md / json / csv 文档导入，用户文档保存到 localStorage，并可与默认知识库一起参与 RAG 检索。" },
  { version: "V1.1", title: "知识库管理体验优化", body: "优化用户文档管理、知识库筛选、搜索、详情展示和导入体验，让 /knowledge 更像真实知识库管理页。" },
  { version: "V1.2", title: "Hybrid RAG 检索质量升级", body: "引入 Query Expansion、多维评分、scoreBreakdown、retrievalConfidence 和低置信边界。" },
  { version: "V1.2.1", title: "AI 工程规范路由优化", body: "JSON repair、fallback、Tool Calling、Agent 评测集等问题优先进入 AI 工程规范场景。" },
  { version: "V1.3", title: "评测历史与报告导出", body: "支持保存评测历史、趋势摘要，并导出 Markdown / JSON 报告，用于持续复盘 Agent 质量。" },
  { version: "V1.3.1", title: "评测面板中文化", body: "统一中文化评测页面文案，修正版本说明，提升产品使用和复盘体验。" },
  { version: "V1.6", title: "Chat 运行历史与 Trace 导出", body: "支持保存 Chat 运行历史，复盘 Router / RAG / Tools / LLM / Retriever Trace，并导出 Markdown / JSON 运行报告。" },
  { version: "V1.8", title: "Knowledge RAG 应用化升级", body: "增强知识库启用/禁用、RAG 引用片段展示、低置信边界提示、回答反馈闭环和知识库质量诊断。" },
  { version: "V1.9", title: "Real API 优先运行时", body: "配置模型服务后默认使用真实模型生成回答；开发模拟模式保留用于离线演示、回归测试和故障兜底。" },
  { version: "V1.9.2", title: "知识库可用性打磨", body: "知识库列表展示启用状态、来源类型、chunks、标签、建议测试问题和质量诊断，支持一键带问题进入 Chat。" },
  { version: "V1.9.3", title: "业务工具可用性打磨", body: "工具中心按业务场景组织，提供流程模板、示例输入、模拟结果和跳转 Chat 验证入口。" },
  { version: "V1.9.4", title: "Release Candidate 收口", body: "统一全站版本语境、演示路径、错误状态和 Real API / 开发模拟模式文案，准备进入外部测试。" },
  { version: "V1.10", title: "Production Readiness 基础", body: "增加服务端运行摘要持久化、Real API 频率限制和口令保护的 /ops 运行状态页，为后续数据库化打基础。" },
  { version: "V1.12.1", title: "客户端存储迁移安全", body: "Chat History、Feedback、Evaluation History 与 RAG Test History 采用版本化本地存储，支持旧数据迁移、非法记录过滤、损坏恢复和容量控制。" },
  { version: "V1.12.2", title: "Ops 隐私与浏览器回归", body: "Ops 问题摘要统一截断并脱敏订单号、手机号、邮箱和长数字；Playwright 覆盖知识库备份恢复与客户端存储迁移。" },
  { version: "V1.12.3", title: "Agent Workspace 结构拆分", body: "将请求状态、反馈提交与展示组合按职责分离，保持 Agent API、运行历史和页面交互兼容，并扩展 Chat Workspace 浏览器回归。" },
  { version: "V1.12.4", title: "Knowledge Workspace 结构拆分", body: "将知识库本地状态、文档操作和展示组合按职责分离，保持知识存储、备份格式、RAG 测试与页面交互兼容。" },
  { version: "V1.12.5", title: "领域类型结构", body: "将共享 TypeScript 类型按 Agent、Knowledge、Tools、Evaluation 和反馈领域拆分，保持 @/types 公共导入与所有数据协议兼容。" },
  { version: "V2.0.0", title: "当前会话多轮上下文", body: "支持同一浏览器当前会话内连续追问、刷新恢复和新建对话隔离；Router、RAG 与工具仍以当前问题为主。" },
];

const engineeringHighlights = [
  "RAG：从 Knowledge Packs、用户导入文档、chunks、keywords、scoreBreakdown 到 sources，形成可解释检索链路。",
  "Agent：Router 判断业务场景和意图，统一编排 RAG、Tools、LLM 与 fallback。",
  "Tool Calling：本地工具支持订单查询、商品查询、规则检索、工单创建、JD 分析和客服回复生成。",
  "结构化输出：Real API 返回 AgentResponse JSON，支持 parse、repair 和文本兜底。",
  "评测闭环：80 条多场景测试用例，支持保存历史、趋势摘要和 Markdown / JSON 报告导出。",
];

export default function AboutPage() {
  return (
    <div className="space-y-8 overflow-x-hidden">
      <PageHeader
        eyebrow="About"
        title={appVersionLabel}
        description="一个面向企业知识库问答与业务流程自动化的 AI Agent 工作台：真实模型优先生成，结合可解释 RAG、业务工具、评测回归、Trace 导出和本地知识库管理。"
      />
      <p className="-mt-5 text-xs text-ink-500">当前运行版本：{appVersionLabel}{buildCommit ? ` · 构建 ${buildCommit}` : ""}</p>
      <section className="rounded-lg border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Product Overview</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-900">让企业知识库回答既能生成，也能被验证。</h2>
            <p className="mt-3 text-sm leading-7 text-ink-600">Enterprise Agent Hub 把用户问题先交给 Agent Router 判断场景和意图，再用 Hybrid RAG 找到可追溯来源，必要时调用业务工具，最后由 Real API 或开发模拟模式生成回答。产品重点不是“单次聊天”，而是把依据、边界、反馈和评测都纳入同一个工作台。</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <article className="rounded-md bg-white p-4 shadow-sm ring-1 ring-brand-100"><p className="text-xs text-ink-500">默认运行时</p><p className="mt-1 font-semibold text-ink-900">Real API 优先</p></article>
            <article className="rounded-md bg-white p-4 shadow-sm ring-1 ring-brand-100"><p className="text-xs text-ink-500">回归验证</p><p className="mt-1 font-semibold text-ink-900">80 条 Mock 评测</p></article>
            <article className="rounded-md bg-white p-4 shadow-sm ring-1 ring-brand-100"><p className="text-xs text-ink-500">知识库持久化</p><p className="mt-1 font-semibold text-ink-900">浏览器 localStorage</p></article>
          </div>
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink-900">解决的问题</h2>
        <div className="grid gap-4 md:grid-cols-3">{productProblems.map((item) => <article key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm leading-7 text-ink-600">{item}</p></article>)}</div>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink-900">核心业务场景</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{coreScenarios.map((item) => <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-semibold text-ink-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-ink-500">{item.body}</p></article>)}</div>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink-900">核心能力</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{capabilities.map((item) => <article key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold leading-6 text-ink-900">{item}</p></article>)}</div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">运行链路</h2>
        <p className="mt-3 text-sm leading-7 text-ink-600">用户输入问题后，系统依次完成场景识别、RAG 检索、工具调用、真实模型生成或兜底回答。主界面展示业务答案和高相关引用，Trace 区保留 Router、Retriever、Tools 和 LLM 细节，方便从产品体验一路追到工程诊断。</p>
      </section>
      <section className="rounded-lg border border-brand-100 bg-brand-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">推荐体验路径</h2>
        <p className="mt-2 text-sm leading-6 text-ink-600">建议按知识库、Chat、业务工具、评测面板的顺序体验完整链路：先准备知识依据，再观察 Agent 如何检索、调用工具、生成回答并被评测验证。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            { href: "/knowledge", title: "/knowledge", desc: "查看默认知识库与用户文档，检查启用状态、chunks 和质量诊断。" },
            { href: "/chat?question=%E6%88%91%E5%87%BA%E5%B7%AE%E5%9B%9E%E6%9D%A5%E6%83%B3%E6%8A%A5%E9%94%80%EF%BC%8C%E5%BA%94%E8%AF%A5%E5%87%86%E5%A4%87%E5%93%AA%E4%BA%9B%E6%9D%90%E6%96%99%EF%BC%9F", title: "/chat", desc: "带入问题但不自动运行，查看 Real API、RAG、工具和 fallback 展示。" },
            { href: "/tools", title: "/tools", desc: "按业务流程查看订单、规则、工单、JD 匹配等工具能力。" },
            { href: "/evaluation", title: "/evaluation", desc: "运行 full Mock 回归，确认 80 条评测和报告导出能力。" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md bg-white p-4 shadow-sm ring-1 ring-brand-100 hover:bg-brand-100">
              <span className="block font-semibold text-brand-800">{item.title}</span>
              <span className="mt-2 block text-sm leading-6 text-ink-600">{item.desc}</span>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink-900">当前版本能力</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{versions.map((item) => <article key={item.version} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{item.version}</span><h3 className="mt-3 font-semibold text-ink-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-ink-500">{item.body}</p></article>)}</div>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">Knowledge Packs</p><p className="mt-2 text-2xl font-semibold text-ink-900">4</p></article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">Mock 文档</p><p className="mt-2 text-2xl font-semibold text-ink-900">42</p></article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">完整评测</p><p className="mt-2 text-2xl font-semibold text-ink-900">80/80</p></article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">passRate</p><p className="mt-2 text-2xl font-semibold text-ink-900">100%</p></article>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">工程实现亮点</h2>
        <div className="mt-4 space-y-3">{engineeringHighlights.map((item) => <p key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-ink-600">{item}</p>)}</div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">当前应用边界</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "用户导入文档和 Chat 运行历史默认保存在当前浏览器 localStorage；发起聊天时，启用文档会发送到本应用服务端参与检索，Real 模式下仅相关命中片段可能发送给模型服务。V1.10 仅服务端记录运行摘要和反馈摘要，不保存完整知识库。",
            "服务端运行摘要默认写入运行用户的本地目录，可通过 EAH_OPS_DATA_DIR 调整；这不是生产级数据库或长期审计系统。",
            "当前 Hybrid RAG 与 Mock Embedding 是本地可解释检索实现，不等同于生产级 Embedding + Vector DB。",
            "默认业务数据仍为模拟数据，适合验证产品链路和工程结构，不代表真实企业系统。",
            "Real API 由服务端环境变量配置，前端不会展示密钥或具体模型服务工程配置。",
            "后续可替换为真实 Embedding 模型、向量数据库、数据库持久化、权限体系和团队审计后台。",
          ].map((item) => <p key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-ink-600">{item}</p>)}
        </div>
      </section>
    </div>
  );
}
