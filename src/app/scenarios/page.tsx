import { PageHeader } from "@/components/PageHeader";

const routerScenarios = [
  {
    name: "企业知识库 Agent",
    description: "处理公司制度、报销、年假、请假、信息安全等企业知识问答，并可升级为工单处理。",
    intents: ["knowledge_qa", "ticket_create"],
    tools: ["searchPolicy", "createTicket"],
    rag: "true",
  },
  {
    name: "电商客服与售后 Agent",
    description: "处理订单、退货、退款、售后、商品库存、尺码建议和客服回复生成。",
    intents: ["policy_check", "order_query", "product_query", "after_sale_reply"],
    tools: ["queryOrder", "queryProduct", "searchPolicy", "generateCustomerReply", "createTicket"],
    rag: "true",
  },
  {
    name: "招聘求职 Agent",
    description: "分析 AI 应用开发岗位、JD 与 mock 简历的匹配度，输出能力差距和建议。",
    intents: ["jd_match"],
    tools: ["analyzeJD"],
    rag: "optional",
  },
];

export default function ScenariosPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Scenario Templates"
        title="场景模板"
        description="V0.4 将场景模板和 Agent Router 对齐，每个场景都明确 intents、tools 和是否使用 RAG。"
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {routerScenarios.map((scenario) => (
          <article key={scenario.name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-ink-900">{scenario.name}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-500">{scenario.description}</p>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-ink-700">intents</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {scenario.intents.map((intent) => (
                    <span key={intent} className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">{intent}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium text-ink-700">tools</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {scenario.tools.map((tool) => (
                    <span key={tool} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-500">{tool}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium text-ink-700">rag</p>
                <p className="mt-2 text-ink-500">{scenario.rag}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
