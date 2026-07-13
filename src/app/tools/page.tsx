import { PageHeader } from "@/components/PageHeader";
import { ToolCard } from "@/components/ToolCard";
import { tools } from "@/data/mock";
import type { ToolName } from "@/types";
import Link from "next/link";

const workflowTemplates = [
  {
    title: "售后退货判断",
    question: "订单10001能不能退？",
    description: "先查询订单状态，再检索售后政策，最后给出可退 / 不可退和下一步建议。",
    steps: ["订单查询", "规则检索", "边界判断"],
  },
  {
    title: "差旅报销材料检查",
    question: "我出差回来想报销，应该准备哪些材料？",
    description: "检索企业报销制度，整理发票、行程、审批和付款凭证等材料清单。",
    steps: ["知识库检索", "材料清单", "流程提醒"],
  },
  {
    title: "报销审批时效",
    question: "公司报销审批需要多久？",
    description: "从制度文档中提取审批节点和时效，并说明可能影响到账的因素。",
    steps: ["制度检索", "时效解释", "风险提示"],
  },
  {
    title: "订单状态查询",
    question: "查询订单10002状态",
    description: "根据订单号查询履约状态，必要时生成客服跟进或工单建议。",
    steps: ["订单查询", "状态解释", "客服动作"],
  },
];

const toolMeta: Partial<Record<ToolName, { businessName: string; businessGoal: string; questions: string[] }>> = {
  queryOrder: {
    businessName: "订单状态与售后资格查询",
    businessGoal: "用于确认订单状态、签收时间、商品信息和退货基础条件，是售后判断的第一步。",
    questions: ["订单10001能不能退？", "查询订单10002状态"],
  },
  queryProduct: {
    businessName: "商品信息与库存查询",
    businessGoal: "用于补充商品名称、库存、尺码建议和卖点，帮助客服给出更完整的答复。",
    questions: ["这个商品还有货吗？", "SKU-AGENT-PLUS 适合什么尺码？"],
  },
  searchPolicy: {
    businessName: "企业制度与售后规则检索",
    businessGoal: "用于检索报销、请假、售后、退款等业务规则，是 RAG 之外的规则查询工具。",
    questions: ["我出差回来想报销，应该准备哪些材料？", "商品超过 7 天还能退吗？", "公司报销审批需要多久？"],
  },
  createTicket: {
    businessName: "异常问题工单创建",
    businessGoal: "当订单、售后或内部流程需要人工跟进时，模拟创建工单并标记优先级。",
    questions: ["订单超过 48 小时未发货，帮我创建工单", "客户投诉物流异常，应该怎么升级处理？"],
  },
  generateCustomerReply: {
    businessName: "客服回复生成",
    businessGoal: "用于根据售后上下文生成清晰、礼貌、可执行的客服回复话术。",
    questions: ["客户说不喜欢想退，客服怎么回复？", "客户物流延迟，客服应该怎么解释？"],
  },
};

const scenarioGroups: Array<{ title: string; description: string; toolNames: ToolName[] }> = [
  {
    title: "电商客服售后流程",
    description: "覆盖订单查询、商品信息、售后规则、异常工单和客服回复。",
    toolNames: ["queryOrder", "queryProduct", "searchPolicy", "createTicket", "generateCustomerReply"],
  },
  {
    title: "企业制度与内部流程",
    description: "覆盖报销、审批、请假、权限等制度规则检索和流程解释。",
    toolNames: ["searchPolicy", "createTicket"],
  },
];

function chatQuestionHref(question: string) {
  return `/chat?question=${encodeURIComponent(question)}`;
}

export default function ToolsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool Center"
        title="业务工具工作台"
        description="按真实业务流程展示 Agent 可调用的订单查询、规则检索、工单创建和客服回复工具；可一键带问题进入 Chat 工作台验证企业知识与流程编排。"
      />

      <section className="grid gap-4 lg:grid-cols-4">
        {workflowTemplates.map((template) => (
          <article key={template.question} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">业务流程模板</p>
            <h2 className="mt-2 font-semibold text-ink-900">{template.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-600">{template.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {template.steps.map((step) => <span key={step} className="rounded bg-slate-50 px-2 py-1 text-xs text-ink-600 ring-1 ring-slate-200">{step}</span>)}
            </div>
            <Link href={chatQuestionHref(template.question)} className="mt-4 inline-flex rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
              去 Chat 测试
            </Link>
          </article>
        ))}
      </section>

      <div className="mt-6 space-y-6">
        {scenarioGroups.map((group) => (
          <section key={group.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4">
              <h2 className="font-semibold text-ink-900">{group.title}</h2>
              <p className="mt-1 text-sm text-ink-600">{group.description}</p>
            </div>
            <div className="grid gap-5">
              {group.toolNames.map((toolName) => {
                const tool = tools.find((item) => item.name === toolName);
                if (!tool) return null;
                const meta = toolMeta[tool.name];
                if (!meta) return null;
                return (
                  <ToolCard
                    key={`${group.title}-${tool.name}`}
                    tool={tool}
                    businessName={meta.businessName}
                    businessGoal={meta.businessGoal}
                    exampleQuestions={meta.questions}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
