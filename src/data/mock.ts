import type {
  AgentDecision,
  ChatMessage,
  EvaluationMetric,
  Feature,
  KnowledgeDocument,
  Scenario,
  TestCase,
  ToolCallLog,
  ToolDefinition,
} from "@/types";

export const features: Feature[] = [
  {
    title: "RAG 知识库问答",
    description: "基于企业文档、政策与 SOP 的检索增强回答，附带来源引用。",
  },
  {
    title: "Agent Router",
    description: "识别业务场景与用户意图，将请求路由到合适的 Agent 模板。",
  },
  {
    title: "Tool Calling",
    description: "通过结构化参数调用订单、商品、工单、JD 分析等业务工具。",
  },
  {
    title: "结构化输出",
    description: "面向前端展示、业务系统写入和评测分析输出稳定 JSON。",
  },
  {
    title: "多场景插件",
    description: "以模板方式扩展知识库、客服售后、招聘匹配等业务能力。",
  },
  {
    title: "评测面板",
    description: "用测试集追踪意图识别、工具命中、引用率和响应耗时。",
  },
];

export const scenarios: Scenario[] = [
  {
    id: "knowledge-agent",
    name: "企业知识库 Agent",
    description: "面向员工制度、流程 SOP、产品资料的企业内部问答助手。",
    questions: ["报销政策怎么走？", "销售合同审批需要哪些材料？", "新员工试用期规则是什么？"],
    tools: ["searchPolicy"],
    outputType: "带引用来源的问答结果",
  },
  {
    id: "commerce-support-agent",
    name: "电商客服与售后 Agent",
    description: "辅助客服查询订单、商品和售后政策，并生成可直接发送的回复。",
    questions: ["订单什么时候发货？", "这个商品支持七天无理由吗？", "帮我创建售后工单。"],
    tools: ["queryOrder", "queryProduct", "searchPolicy", "createTicket", "generateCustomerReply"],
    outputType: "客服回复 + 工单建议 + 工具调用记录",
  },
  {
    id: "jd-match-agent",
    name: "招聘求职 JD 匹配 Agent",
    description: "分析岗位 JD 与候选人经历，输出匹配度、差距和面试准备建议。",
    questions: ["这份 JD 和我的简历匹配吗？", "AI 应用开发工程师需要补哪些项目？", "帮我拆解岗位能力要求。"],
    tools: ["analyzeJD", "searchPolicy"],
    outputType: "匹配评分 + 能力差距 + 行动建议",
  },
];

export const chatMessages: ChatMessage[] = [
  {
    role: "user",
    content: "客户说订单 EAH20260624001 已经 3 天没发货，请帮我查一下并生成回复。",
  },
  {
    role: "assistant",
    content: "已识别为电商客服与售后场景。我会先查询订单状态，再检查发货政策，最后生成客服回复。",
  },
  {
    role: "assistant",
    content: "订单当前处于仓库拣货中，预计 24 小时内发出。建议向客户说明原因并提供补偿券。",
  },
];

export const agentDecisions: AgentDecision[] = [
  {
    step: "场景识别",
    detail: "命中电商客服与售后 Agent，置信度 0.94。",
    status: "done",
  },
  {
    step: "意图拆解",
    detail: "用户需要订单查询、政策检索和客服回复生成。",
    status: "done",
  },
  {
    step: "工具编排",
    detail: "按 queryOrder -> searchPolicy -> generateCustomerReply 顺序执行。",
    status: "done",
  },
];

export const toolCallLogs: ToolCallLog[] = [
  {
    tool: "queryOrder",
    input: { orderId: "EAH20260624001" },
    output: { status: "picking", etaHours: 24, warehouse: "华东一号仓" },
  },
  {
    tool: "searchPolicy",
    input: { keyword: "延迟发货补偿", scene: "after_sales" },
    output: { policyId: "POLICY-18", compensation: "8 元优惠券", citation: "售后政策第 4.2 条" },
  },
  {
    tool: "generateCustomerReply",
    input: { tone: "friendly", includeCoupon: true },
    output: { reply: "很抱歉让您久等了，您的订单预计 24 小时内发出，我们将补发 8 元优惠券。" },
  },
];

export const structuredOutput = {
  scenario: "commerce_support",
  intent: "shipping_delay_reply",
  answer:
    "订单 EAH20260624001 当前在华东一号仓拣货中，预计 24 小时内发出。建议向客户致歉并补发 8 元优惠券。",
  tools: ["queryOrder", "searchPolicy", "generateCustomerReply"],
  citations: ["售后政策第 4.2 条"],
  confidence: 0.92,
};

export const documents: KnowledgeDocument[] = [
  {
    id: "doc-001",
    title: "员工报销与差旅制度",
    source: "HR-Policy-2026.pdf",
    owner: "人力行政部",
    updatedAt: "2026-06-01",
    chunks: [
      {
        id: "chunk-001",
        content: "员工差旅申请需在出行前 3 个工作日提交，并由直属主管审批。",
        score: 0.91,
      },
      {
        id: "chunk-002",
        content: "单次交通费用超过 2000 元时，需要补充出差目的和客户拜访记录。",
        score: 0.86,
      },
    ],
    citations: ["第 2 章 差旅申请", "第 4 章 费用标准"],
  },
  {
    id: "doc-002",
    title: "电商售后处理 SOP",
    source: "Support-SOP.md",
    owner: "客服运营部",
    updatedAt: "2026-06-10",
    chunks: [
      {
        id: "chunk-101",
        content: "延迟发货超过 48 小时可发放 8 元优惠券，并同步创建售后跟进工单。",
        score: 0.94,
      },
      {
        id: "chunk-102",
        content: "高价值客户投诉需要在 2 小时内升级到客服主管处理。",
        score: 0.83,
      },
    ],
    citations: ["售后政策第 4.2 条", "客服升级规则第 3 条"],
  },
  {
    id: "doc-003",
    title: "AI 应用开发工程师 JD 样例",
    source: "JD-AI-App-Engineer.docx",
    owner: "招聘团队",
    updatedAt: "2026-06-15",
    chunks: [
      {
        id: "chunk-201",
        content: "候选人需要熟悉 RAG、Agent 编排、工具调用、结构化输出和前端产品化落地。",
        score: 0.96,
      },
      {
        id: "chunk-202",
        content: "有企业知识库、客服自动化或招聘匹配项目经验者优先。",
        score: 0.9,
      },
    ],
    citations: ["岗位要求第 1 条", "加分项第 2 条"],
  },
];

export const tools: ToolDefinition[] = [
  {
    name: "queryOrder",
    description: "查询订单状态、物流节点和预计发货时间。",
    inputExample: { orderId: "EAH20260624001" },
    outputExample: { status: "picking", etaHours: 24, warehouse: "华东一号仓" },
  },
  {
    name: "queryProduct",
    description: "查询商品库存、价格、售后规则和核心卖点。",
    inputExample: { skuId: "SKU-AGENT-PLUS" },
    outputExample: { stock: 128, price: 399, returnPolicy: "7 天无理由" },
  },
  {
    name: "searchPolicy",
    description: "检索企业制度、售后政策或招聘标准，并返回引用来源。",
    inputExample: { keyword: "延迟发货补偿", scene: "after_sales" },
    outputExample: { policyId: "POLICY-18", citation: "售后政策第 4.2 条" },
  },
  {
    name: "createTicket",
    description: "为售后、IT 支持或内部流程创建跟进工单。",
    inputExample: { category: "shipping_delay", priority: "medium", owner: "support" },
    outputExample: { ticketId: "TCK-20260624-009", status: "created" },
  },
  {
    name: "analyzeJD",
    description: "分析 JD 与候选人经历，输出匹配度和能力差距。",
    inputExample: { jdId: "JD-AI-APP", resumeProfileId: "candidate-demo" },
    outputExample: { matchScore: 86, gaps: ["线上评测经验", "多工具编排案例"] },
  },
  {
    name: "generateCustomerReply",
    description: "根据业务事实、政策和语气生成客服回复。",
    inputExample: { facts: ["订单拣货中"], tone: "friendly", includeCoupon: true },
    outputExample: { reply: "很抱歉让您久等了，您的订单预计 24 小时内发出。" },
  },
];

export const metrics: EvaluationMetric[] = [
  { label: "场景识别准确率", value: "94.2%", trend: "+3.1%" },
  { label: "意图识别准确率", value: "91.8%", trend: "+2.4%" },
  { label: "工具调用命中率", value: "88.6%", trend: "+5.7%" },
  { label: "来源引用率", value: "96.4%", trend: "+1.2%" },
  { label: "平均响应耗时", value: "1.8s", trend: "-0.4s" },
];

export const testCases: TestCase[] = [
  {
    id: "TC-001",
    scenario: "企业知识库 Agent",
    input: "差旅报销需要提前多久申请？",
    expectedTool: "searchPolicy",
    result: "pass",
    latency: "1.4s",
  },
  {
    id: "TC-002",
    scenario: "电商客服与售后 Agent",
    input: "订单三天未发货，帮我处理。",
    expectedTool: "queryOrder + searchPolicy",
    result: "pass",
    latency: "1.9s",
  },
  {
    id: "TC-003",
    scenario: "招聘求职 JD 匹配 Agent",
    input: "这个 AI 应用开发岗位和我的项目匹配吗？",
    expectedTool: "analyzeJD",
    result: "review",
    latency: "2.2s",
  },
  {
    id: "TC-004",
    scenario: "电商客服与售后 Agent",
    input: "帮客户创建一个退货工单。",
    expectedTool: "createTicket",
    result: "pass",
    latency: "1.6s",
  },
];
