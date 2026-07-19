import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatePanel } from "@/components/ui/StatePanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { appVersionLabel } from "@/lib/appVersion";

const experiencePath = [
  {
    href: "/knowledge",
    title: "准备知识依据",
    description: "管理知识文档与企业知识包，检查启用状态、分块质量和导入任务。",
  },
  {
    href: "/chat?question=%E8%AE%A2%E5%8D%9510001%E8%83%BD%E4%B8%8D%E8%83%BD%E9%80%80%EF%BC%9F",
    title: "进入聊天工作台",
    description: "带入业务问题，查看回答、引用依据、工具调用和安全 Trace。",
  },
  {
    href: "/tools",
    title: "验证业务流程",
    description: "按售后、差旅、审批和订单流程检查工具输入、输出与下一步动作。",
  },
  {
    href: "/evaluation",
    title: "复盘运行质量",
    description: "运行 Mock 回归并查看通过率、失败原因、趋势和报告。",
  },
];

const workspaceCapabilities = [
  {
    title: "可信知识问答",
    description: "Hybrid RAG 返回可追溯来源，并明确低置信度、无依据和模型降级状态。",
    status: "可解释 RAG",
  },
  {
    title: "连续会话上下文",
    description: "通过 Token Budget、相关历史选择和滚动摘要控制长对话上下文。",
    status: "V2.1 上下文管理",
  },
  {
    title: "服务端持久化",
    description: "数据库健康时使用 PostgreSQL；未配置时保留本地模式，故障时进入明确的只读降级状态。",
    status: "local / server / degraded",
  },
  {
    title: "企业知识导入",
    description: "支持知识包、批量预览、重复检测、冲突处理、任务恢复与分块质量诊断。",
    status: "TXT / MD / PDF / DOCX",
  },
  {
    title: "业务流程工具",
    description: "覆盖订单、售后规则、工单、客服回复和企业制度查询，结果可回到 Chat 继续处理。",
    status: "可审计工具调用",
  },
  {
    title: "评测与运行观测",
    description: "使用 Mock 回归、反馈指标和安全聚合状态定位路由、检索与生成质量问题。",
    status: "不记录敏感正文",
  },
];

const businessScenarios = [
  {
    title: "企业制度与内部流程",
    description: "报销、差旅、审批、请假、信息安全与异常工单。",
    examples: ["报销材料检查", "审批时效说明", "制度依据查询"],
  },
  {
    title: "电商客服与售后协同",
    description: "订单状态、退换规则、库存信息、客服回复与人工升级。",
    examples: ["订单退货判断", "物流异常处理", "客服回复生成"],
  },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="企业 Agent 工作台"
        title="把企业知识、业务流程与运行质量放进同一个工作台"
        description="Enterprise Agent Hub 面向持续工作的企业团队：用可解释知识依据回答问题，用业务工具推进流程，并通过上下文管理、评测与运行状态保持结果可信。"
        meta={
          <>
            <StatusBadge tone="info">{appVersionLabel}</StatusBadge>
            <StatusBadge tone="success">企业知识库问答</StatusBadge>
            <StatusBadge tone="neutral">浏览器级工作区隔离</StatusBadge>
          </>
        }
        actions={
          <>
            <Link href="/chat" className="app-button-primary">
              进入聊天工作台
            </Link>
            <Link href="/knowledge" className="app-button-secondary">
              管理知识库
            </Link>
          </>
        }
      />

      <SectionCard
        title="推荐工作路径"
        description="从知识依据开始，在同一条可验证链路中完成问答、流程处理和质量复盘。"
      >
        <ol className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {experiencePath.map((item, index) => (
            <li key={item.href} className="min-w-0 py-4 first:pt-0 last:pb-0 lg:px-5 lg:py-0 lg:first:pl-0 lg:last:pr-0">
              <Link href={item.href} className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <span className="app-tabular text-xs font-semibold text-brand-700">步骤 {index + 1}</span>
                <span className="mt-1 block font-semibold text-ink-950 group-hover:text-brand-700">{item.title}</span>
                <span className="mt-1 block text-sm leading-6 text-ink-500">{item.description}</span>
              </Link>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard
        title="当前工作台能力"
        description="围绕企业知识、连续会话、业务执行和运行质量组织，不扩展为泛化营销功能。"
      >
        <div className="grid gap-x-8 gap-y-0 lg:grid-cols-2">
          {workspaceCapabilities.map((capability) => (
            <article key={capability.title} className="border-b border-slate-200 py-4 first:pt-0 lg:[&:nth-last-child(-n+2)]:border-b-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink-950">{capability.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink-500">{capability.description}</p>
                </div>
                <StatusBadge className="shrink-0" showDot={false}>{capability.status}</StatusBadge>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <SectionCard title="正式业务场景" description="当前产品聚焦企业内部知识与流程自动化。">
          <div className="divide-y divide-slate-200">
            {businessScenarios.map((scenario) => (
              <article key={scenario.title} className="py-4 first:pt-0 last:pb-0">
                <h3 className="font-semibold text-ink-950">{scenario.title}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-500">{scenario.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {scenario.examples.map((example) => (
                    <StatusBadge key={example} showDot={false}>{example}</StatusBadge>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <Link href="/tools" className="app-button-tertiary mt-4 px-0 hover:bg-transparent">
            查看业务工具与流程模板
          </Link>
        </SectionCard>

        <div className="space-y-4">
          <StatePanel
            tone="info"
            title="存储方式由运行环境决定"
            description="服务端模式按匿名工作区隔离持久化；本地模式继续使用浏览器数据；degraded 模式不会伪装保存成功。"
          />
          <StatePanel
            tone="neutral"
            title="当前安全边界"
            description="本版本不包含完整登录权限、对象存储、OCR、向量数据库、跨会话长期记忆或用户画像。"
          />
          <Link href="/about" className="app-button-secondary w-full">
            查看系统模块与能力边界
          </Link>
        </div>
      </div>
    </div>
  );
}
