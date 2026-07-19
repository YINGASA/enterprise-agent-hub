import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatePanel } from "@/components/ui/StatePanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { appVersionLabel, buildCommit } from "@/lib/appVersion";

const productModules = [
  {
    title: "聊天工作台",
    description: "连续会话、流式生成、停止、重新生成、编辑重发、反馈、引用依据和安全 Trace。",
    href: "/chat",
  },
  {
    title: "企业知识库",
    description: "知识文档、企业知识包、批量导入、重复检测、冲突处理、分块质量和 RAG 验证。",
    href: "/knowledge",
  },
  {
    title: "业务工具",
    description: "订单、售后规则、企业制度、异常工单和客服回复等可解释业务动作。",
    href: "/tools",
  },
  {
    title: "评测与运行分析",
    description: "Mock 回归、Real API 状态、失败原因、反馈指标和安全聚合运行状态。",
    href: "/evaluation",
  },
];

const runtimeFlow = [
  ["理解问题", "Router 识别当前场景与任务意图。"],
  ["准备上下文", "在 Token Budget 内组合滚动摘要、相关历史与最近消息。"],
  ["检索与执行", "RAG 提供依据，必要时调用订单、规则或工单工具。"],
  ["生成并完成", "Real API 或开发模拟模式生成回答，完成栅栏后才持久化。"],
  ["复盘质量", "通过引用、Trace、反馈、Evaluation 和 Ops 定位质量问题。"],
];

const currentCapabilities = [
  {
    version: "V2.1",
    title: "Conversation Context Manager",
    description: "使用确定性 Token 估算、上下文预算、相关历史选择和滚动摘要支持长对话。",
  },
  {
    version: "V2.2.0",
    title: "服务端存储与持久化",
    description: "引入 PostgreSQL、Repository 适配、浏览器级匿名工作区隔离和 localStorage 平滑迁移。",
  },
  {
    version: "V2.2.1",
    title: "企业知识包与批量导入",
    description: "支持 TXT、Markdown、文本型 PDF 和 DOCX 的预览、冲突处理、任务进度与失败重试。",
  },
  {
    version: "V2.2.2",
    title: "依赖兼容与生产导入加固",
    description: "固定 Node 20 兼容链路，完善导入限额、claim/lease、索引、恢复和生产检查。",
  },
  {
    version: "V2.2.3",
    title: "界面体验与产品质感优化",
    description: "统一企业工作台层级、状态、响应式和无障碍体验，不改变后端业务语义。",
  },
];

const supportedBoundaries = [
  "服务端模式使用 PostgreSQL 保存会话、消息、滚动摘要、知识文档、分块和导入任务。",
  "数据库未配置时保留 local 模式；数据库暂不可用时进入 degraded，只读展示且写入明确失败。",
  "匿名工作区身份由安全 HttpOnly Cookie 解析，所有服务端业务查询都按工作区隔离。",
  "原始上传文件不长期保存；正式保存的是受限文本、元数据、checksum、文档和知识分块。",
];

const unsupportedBoundaries = [
  "浏览器级工作区隔离不等于完整登录、企业组织、成员邀请或权限认证。",
  "未接入 COS 等对象存储，也不支持 OCR；扫描型 PDF 无法提取文字。",
  "未引入向量数据库、用户画像、跨会话长期记忆或跨工作区记忆。",
  "示例订单与部分业务工具数据用于验证产品链路，不代表真实企业生产系统。",
];

const demoPath = [
  { href: "/knowledge", label: "1. 知识库", description: "准备文档、知识包和可用的 RAG 依据。" },
  { href: "/chat", label: "2. 聊天工作台", description: "观察回答、来源、工具和上下文状态。" },
  { href: "/tools", label: "3. 业务工具", description: "理解流程模板和工具返回如何进入回答。" },
  { href: "/evaluation", label: "4. 评测中心", description: "运行回归并定位失败原因与趋势。" },
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="产品与系统说明"
        title={appVersionLabel}
        description="面向企业知识库问答与业务流程自动化的 Agent 工作台。产品把知识依据、上下文、业务工具、模型生成、持久化和质量复盘放在同一条可信链路中。"
        meta={
          <>
            <StatusBadge tone="success">当前版本能力已启用</StatusBadge>
            <StatusBadge tone="info">PostgreSQL 可选服务端模式</StatusBadge>
            <StatusBadge tone="neutral">浏览器级匿名工作区</StatusBadge>
            {buildCommit ? <span className="app-tabular">构建 {buildCommit}</span> : null}
          </>
        }
        actions={
          <>
            <Link href="/chat" className="app-button-primary">进入聊天工作台</Link>
            <Link href="/knowledge" className="app-button-secondary">打开知识库</Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.5fr)]">
        <SectionCard title="产品定位" description="专业、克制、可解释，适合持续工作和真实企业场景演示。">
          <p className="text-sm leading-7 text-ink-600">
            Enterprise Agent Hub 不把单次模型回答视为终点。系统会说明当前使用的知识依据、工具动作、运行模式和失败边界，并通过会话持久化、评测回归和运行分析保持链路可验证。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge tone="success">依据可追溯</StatusBadge>
            <StatusBadge tone="info">上下文有预算</StatusBadge>
            <StatusBadge tone="neutral">失败不伪装成功</StatusBadge>
            <StatusBadge tone="neutral">敏感正文不进入 Ops</StatusBadge>
          </div>
        </SectionCard>
        <StatePanel
          tone="info"
          title="工作区隔离说明"
          description="当前实现提供浏览器级匿名工作区隔离。它能阻止不同浏览器直接共享服务端数据，但不等同于完整多租户账号与权限体系。"
        />
      </div>

      <SectionCard title="系统模块" description="各页面围绕同一业务链路协作，保留原有 URL 和功能入口。">
        <div className="grid gap-3 md:grid-cols-2">
          {productModules.map((module) => (
            <Link key={module.href} href={module.href} className="app-panel-muted group block p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <span className="font-semibold text-ink-950 group-hover:text-brand-700">{module.title}</span>
              <span className="mt-1 block text-sm leading-6 text-ink-500">{module.description}</span>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="运行工作流" description="服务端负责最终上下文规划，Streaming 与非 Streaming、Mock 与 Real 共享同一条 Pipeline。">
        <ol className="divide-y divide-slate-200">
          {runtimeFlow.map(([title, description], index) => (
            <li key={title} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-baseline">
              <p className="font-semibold text-ink-950"><span className="app-tabular mr-2 text-xs text-brand-700">{String(index + 1).padStart(2, "0")}</span>{title}</p>
              <p className="text-sm leading-6 text-ink-500">{description}</p>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title="当前版本能力" description="只保留与当前系统结构直接相关的关键里程碑，避免用历史卡片淹没产品信息。">
        <div className="divide-y divide-slate-200">
          {currentCapabilities.map((item) => (
            <article key={item.version} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[6rem_minmax(0,1fr)]">
              <StatusBadge tone={item.version === "V2.2.3" ? "info" : "neutral"} className="w-fit self-start" showDot={item.version === "V2.2.3"}>{item.version}</StatusBadge>
              <div>
                <h3 className="font-semibold text-ink-950">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-500">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="当前支持" description="这些能力具备明确的数据与运行语义。">
          <ul className="space-y-3">
            {supportedBoundaries.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-ink-600">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="暂不包含" description="不把尚未完成的能力包装成现有产品功能。">
          <ul className="space-y-3">
            {unsupportedBoundaries.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-ink-600">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="推荐演示路径" description="四个入口覆盖从知识准备到质量复盘的完整链路。">
        <ol className="grid divide-y divide-slate-200 md:grid-cols-2 md:gap-x-6 md:divide-y-0 xl:grid-cols-4 xl:divide-x">
          {demoPath.map((item) => (
            <li key={item.href} className="py-3 first:pt-0 last:pb-0 md:border-b md:border-slate-200 md:py-3 xl:border-b-0 xl:px-5 xl:first:pl-0 xl:last:pr-0">
              <Link href={item.href} className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <span className="font-semibold text-brand-700 group-hover:text-brand-800">{item.label}</span>
                <span className="mt-1 block text-sm leading-6 text-ink-500">{item.description}</span>
              </Link>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}
