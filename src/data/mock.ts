import type {
  AfterSalePolicy,
  AgentExample,
  AgentDecision,
  ChatMessage,
  CompanyPolicy,
  EvaluationMetric,
  Feature,
  InterviewQuestion,
  JobDescription,
  KnowledgeDocument,
  Order,
  PolicyDocument,
  Product,
  ResumeProfile,
  Scenario,
  TestCase,
  ToolCallLog,
  ToolDefinition,
} from "@/types";

export const features: Feature[] = [
  { title: "RAG 知识库问答", description: "基于企业文档、政策与 SOP 的检索增强回答，附带来源引用。" },
  { title: "Agent Router", description: "识别业务场景与用户意图，将请求路由到合适的 Agent 模板。" },
  { title: "Tool Calling", description: "通过结构化参数调用订单、商品、工单、JD 分析等业务工具。" },
  { title: "结构化输出", description: "面向前端展示、业务系统写入和评测分析输出稳定 JSON。" },
  { title: "多场景插件", description: "以模板方式扩展知识库、客服售后、招聘匹配等业务能力。" },
  { title: "评测面板", description: "用测试集追踪意图识别、工具命中、引用率和响应耗时。" },
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

export const companyPolicies: CompanyPolicy[] = [
  {
    id: "CP-EXP-001",
    title: "员工报销制度",
    category: "expense",
    summary: "规范差旅、交通、餐补和客户拜访相关费用报销流程。",
    rules: ["差旅申请需在出行前 3 个工作日提交。", "报销材料包括电子发票、行程单、付款凭证和客户拜访记录。", "报销单据需在费用发生后 30 天内提交。"],
    updatedAt: "2026-06-01",
  },
  {
    id: "CP-VAC-001",
    title: "年假制度",
    category: "vacation",
    summary: "说明员工年假额度、申请规则和跨年结转限制。",
    rules: ["入职满一年后可申请带薪年假。", "连续休假超过 5 天需提前 10 个工作日申请。", "年假原则上不跨两个自然年累计。"],
    updatedAt: "2026-05-20",
  },
  {
    id: "CP-LEV-001",
    title: "请假制度",
    category: "leave",
    summary: "覆盖事假、病假、调休和紧急请假审批规则。",
    rules: ["病假需在返岗后 3 个工作日内补充证明。", "事假超过 2 天需部门负责人审批。", "紧急请假可先口头报备，24 小时内补交申请。"],
    updatedAt: "2026-04-18",
  },
  {
    id: "CP-SEC-001",
    title: "信息安全制度",
    category: "security",
    summary: "规范账号权限、敏感数据、外发资料和办公设备安全。",
    rules: ["禁止将客户数据上传到未审批的第三方工具。", "离职或转岗需在 1 个工作日内回收系统权限。", "外发合同、报价单和客户清单前需完成脱敏审查。"],
    updatedAt: "2026-06-12",
  },
];

export const policyDocuments: PolicyDocument[] = [
  {
    id: "DOC-HR-001",
    title: "员工报销与差旅制度",
    category: "HR Policy",
    content: "员工差旅申请需在出行前 3 个工作日提交，直属主管审批后方可预订交通和住宿。报销单据需在费用发生后 30 天内提交。",
    updatedAt: "2026-06-01",
  },
  {
    id: "DOC-HR-002",
    title: "请假与年假管理办法",
    category: "HR Policy",
    content: "入职满一年后可申请带薪年假；连续休假超过 5 天需提前 10 个工作日申请。病假需补充正规医疗证明。",
    updatedAt: "2026-05-20",
  },
  {
    id: "DOC-SEC-001",
    title: "信息安全与数据外发规范",
    category: "Security",
    content: "客户数据、合同报价和候选人资料均属于敏感信息，外发前必须经过权限审批和脱敏处理。",
    updatedAt: "2026-06-12",
  },
];

export const products: Product[] = [
  {
    id: "SKU-AGENT-PLUS",
    name: "Agent Plus 智能夹克",
    category: "服饰",
    price: 399,
    sizeAdvice: "标准版型，身高 170-178cm 且体重 60-72kg 建议 M 码。",
    stock: 128,
    sellingPoints: ["防泼水面料", "通勤轻量设计", "支持 7 天无理由退货"],
  },
  {
    id: "SKU-RAG-BAG",
    name: "RAG Commuter 双肩包",
    category: "箱包",
    price: 269,
    sizeAdvice: "容量 22L，可放 15.6 英寸笔记本。",
    stock: 42,
    sellingPoints: ["独立电脑仓", "多层收纳", "一年质保"],
  },
  {
    id: "SKU-LLM-EARBUDS",
    name: "LLM Lite 降噪耳机",
    category: "数码",
    price: 599,
    sizeAdvice: "附 S/M/L 三套耳塞，建议首次使用 M 码。",
    stock: 0,
    sellingPoints: ["主动降噪", "低延迟会议模式", "拆封后非质量问题不支持退货"],
  },
];

export const orders: Order[] = [
  { id: "EAH20260624001", user: "张女士", productId: "SKU-AGENT-PLUS", productName: "Agent Plus 智能夹克", status: "picking", signedAt: null, opened: false, returnSupported: true },
  { id: "EAH20260618008", user: "李先生", productId: "SKU-RAG-BAG", productName: "RAG Commuter 双肩包", status: "signed", signedAt: "2026-06-20T10:32:00+08:00", opened: false, returnSupported: true },
  { id: "EAH20260612003", user: "王同学", productId: "SKU-LLM-EARBUDS", productName: "LLM Lite 降噪耳机", status: "signed", signedAt: "2026-06-14T16:20:00+08:00", opened: true, returnSupported: false },
];

export const afterSalePolicies: AfterSalePolicy[] = [
  { id: "ASP-RETURN-7D", title: "7 天无理由退货", category: "return", rules: ["签收后 7 天内且不影响二次销售可申请无理由退货。", "服饰和箱包类商品需吊牌、包装完整。"], updatedAt: "2026-06-05" },
  { id: "ASP-QUALITY-001", title: "质量问题售后", category: "quality", rules: ["质量问题需上传照片或视频凭证。", "确认质量问题后可优先换货，缺货时支持退款。"], updatedAt: "2026-06-05" },
  { id: "ASP-OPENED-001", title: "已拆封限制", category: "opened_limit", rules: ["数码耳机、贴身用品拆封后非质量问题不支持退货。", "已拆封商品如存在质量问题仍可进入质量售后流程。"], updatedAt: "2026-06-05" },
  { id: "ASP-SPECIAL-001", title: "特殊商品限制", category: "special_goods", rules: ["定制商品、临期清仓商品不支持无理由退货。", "特殊限制会在商品详情页明确展示。"], updatedAt: "2026-06-05" },
];

export const jobDescriptions: JobDescription[] = [
  {
    id: "JD-AI-APP-ENG",
    title: "AI 应用开发工程师",
    level: "初中级/校招可投",
    keywords: ["RAG", "Agent", "Tool Calling", "结构化输出", "Next.js", "TypeScript", "评测"],
    responsibilities: ["开发企业知识库问答和业务流程自动化 Agent。", "设计工具调用协议和结构化输出格式。", "建设评测集并跟踪模型应用质量。"],
    requirements: ["熟悉 TypeScript 和前端工程化。", "理解 RAG、Agent Router 和 Tool Calling 基本流程。", "能够用 mock 数据快速搭建可演示原型。"],
  },
  {
    id: "JD-LLM-INTERN",
    title: "大模型应用开发实习生",
    level: "实习",
    keywords: ["Prompt", "RAG", "Python", "API 调用", "数据清洗", "评测"],
    responsibilities: ["协助整理业务知识库和测试集。", "编写 Prompt 与 API 调用脚本。", "分析模型回答质量并输出优化建议。"],
    requirements: ["了解大模型 API 基本调用方式。", "具备脚本开发和数据处理能力。", "有 AI 应用 Demo 或课程项目优先。"],
  },
  {
    id: "JD-FE-INTERN",
    title: "前端开发实习生",
    level: "实习",
    keywords: ["React", "Next.js", "TypeScript", "Tailwind CSS", "组件化", "可视化"],
    responsibilities: ["开发 B 端页面和可复用组件。", "对接后端 API 并处理异常状态。", "参与前端体验优化和数据展示。"],
    requirements: ["熟悉 React 和 TypeScript。", "理解响应式布局和组件状态管理。", "有中后台项目经验优先。"],
  },
];

export const sampleResume: ResumeProfile = {
  id: "resume-demo-ai-app",
  name: "候选人 Demo",
  summary: "面向 AI 应用开发工程师岗位的模拟简历，包含企业 Agent 平台、RAG 问答、工具调用和前端工程化项目经验。",
  skills: ["TypeScript", "Next.js", "React", "Tailwind CSS", "RAG", "Agent Router", "Tool Calling", "结构化输出", "Mock 数据", "评测面板"],
  projects: [
    "Enterprise Agent Hub：企业知识库与业务流程自动化 Agent 平台，覆盖知识库问答、客服售后和 JD 匹配场景。",
    "RAG Knowledge Demo：实现文档切片、来源引用展示和检索结果 mock 编排。",
    "客服工具中心：模拟订单查询、商品查询、售后政策检索和客服回复生成。",
  ],
};

export const interviewQuestions: InterviewQuestion[] = [
  { id: "IQ-AI-001", jobId: "JD-AI-APP-ENG", question: "请说明你会如何设计一个支持多业务场景的 Agent Router？", focus: "场景识别、意图拆解、工具选择、结构化输出。" },
  { id: "IQ-AI-002", jobId: "JD-AI-APP-ENG", question: "RAG 回答为什么需要来源引用？你会如何在前端展示 citation？", focus: "可信度、可追溯性、chunk 与文档映射。" },
  { id: "IQ-LLM-001", jobId: "JD-LLM-INTERN", question: "如果模型回答命中率不稳定，你会如何构造测试集和评测指标？", focus: "测试样本、准确率、工具命中率、失败案例分析。" },
  { id: "IQ-FE-001", jobId: "JD-FE-INTERN", question: "如何把复杂工具调用结果做成稳定、可维护的前端组件？", focus: "组件拆分、状态管理、异常展示、JSON 可读性。" },
];

export const documents: KnowledgeDocument[] = [
  {
    id: "doc-001",
    title: "员工报销与差旅制度",
    category: "HR Policy",
    content: "员工差旅申请需在出行前 3 个工作日提交，并由直属主管审批。报销材料包括电子发票、行程单、付款凭证和客户拜访记录。单次交通费用超过 2000 元时，需要补充出差目的和客户拜访记录。报销单据需在费用发生后 30 天内提交。",
    createdAt: "2026-05-10",
    updatedAt: "2026-06-01",
    source: "HR-Policy-2026.pdf",
    owner: "人力行政部",
    isDefault: true,
    chunks: [
      { id: "chunk-001", content: "员工差旅申请需在出行前 3 个工作日提交，并由直属主管审批。", score: 0.91 },
      { id: "chunk-002", content: "报销材料包括电子发票、行程单、付款凭证和客户拜访记录。", score: 0.88 },
    ],
    citations: ["第 2 章 差旅申请", "第 4 章 费用标准"],
  },
  {
    id: "doc-002",
    title: "年假与请假管理办法",
    category: "HR Policy",
    content: "入职满一年后可申请带薪年假。连续休假超过 5 天需提前 10 个工作日申请。病假需在返岗后 3 个工作日内补充正规医疗证明。紧急请假可先口头报备，24 小时内补交申请。",
    createdAt: "2026-05-01",
    updatedAt: "2026-05-20",
    source: "Leave-Policy-2026.pdf",
    owner: "人力行政部",
    isDefault: true,
    chunks: [
      { id: "chunk-101", content: "入职满一年后可申请带薪年假。连续休假超过 5 天需提前 10 个工作日申请。", score: 0.9 },
      { id: "chunk-102", content: "病假需在返岗后 3 个工作日内补充正规医疗证明。", score: 0.86 },
    ],
    citations: ["请假管理第 1 条", "病假规则第 3 条"],
  },
  {
    id: "doc-003",
    title: "信息安全与数据外发规范",
    category: "Security",
    content: "客户数据、合同报价和候选人资料均属于敏感信息。禁止将客户数据上传到未审批的第三方工具。外发合同、报价单和客户清单前需完成脱敏审查。离职或转岗需在 1 个工作日内回收系统权限。",
    createdAt: "2026-05-25",
    updatedAt: "2026-06-12",
    source: "Security-Guide.md",
    owner: "信息安全部",
    isDefault: true,
    chunks: [
      { id: "chunk-201", content: "客户数据、合同报价和候选人资料均属于敏感信息。", score: 0.92 },
      { id: "chunk-202", content: "外发合同、报价单和客户清单前需完成脱敏审查。", score: 0.87 },
    ],
    citations: ["数据安全第 2 条", "权限管理第 4 条"],
  },
  {
    id: "doc-004",
    title: "电商售后与退货规则",
    category: "After Sales",
    content: "签收后 7 天内且不影响二次销售可申请无理由退货。服饰和箱包类商品需吊牌、包装完整。数码耳机、贴身用品拆封后非质量问题不支持退货。质量问题需上传照片或视频凭证，确认后可优先换货，缺货时支持退款。延迟发货超过 48 小时可发放 8 元优惠券，并同步创建售后跟进工单。",
    createdAt: "2026-06-01",
    updatedAt: "2026-06-10",
    source: "Support-SOP.md",
    owner: "客服运营部",
    isDefault: true,
    chunks: [
      { id: "chunk-301", content: "签收后 7 天内且不影响二次销售可申请无理由退货。", score: 0.94 },
      { id: "chunk-302", content: "数码耳机、贴身用品拆封后非质量问题不支持退货。", score: 0.9 },
      { id: "chunk-303", content: "延迟发货超过 48 小时可发放 8 元优惠券。", score: 0.88 },
    ],
    citations: ["售后政策第 4.2 条", "退货规则第 1 条"],
  },
  {
    id: "doc-005",
    title: "AI 应用开发工程师岗位要求说明",
    category: "Recruiting",
    content: "AI 应用开发工程师需要熟悉 RAG、Agent Router、Tool Calling、结构化输出和前端产品化落地。候选人应能用 TypeScript、Next.js 和 Tailwind CSS 搭建 B 端 SaaS 原型，并理解评测集、工具调用命中率、来源引用率等质量指标。有企业知识库、客服自动化或招聘匹配项目经验者优先。",
    createdAt: "2026-06-08",
    updatedAt: "2026-06-15",
    source: "JD-AI-App-Engineer.docx",
    owner: "招聘团队",
    isDefault: true,
    chunks: [
      { id: "chunk-401", content: "AI 应用开发工程师需要熟悉 RAG、Agent Router、Tool Calling、结构化输出和前端产品化落地。", score: 0.96 },
      { id: "chunk-402", content: "候选人应能用 TypeScript、Next.js 和 Tailwind CSS 搭建 B 端 SaaS 原型。", score: 0.9 },
    ],
    citations: ["岗位要求第 1 条", "加分项第 2 条"],
  },
];

export const chatMessages: ChatMessage[] = [
  { role: "user", content: "客户说订单 EAH20260624001 已经 3 天没发货，请帮我查一下并生成回复。" },
  { role: "assistant", content: "已识别为电商客服与售后场景。我会先查询订单状态，再检查发货政策，最后生成客服回复。" },
  { role: "assistant", content: "订单当前处于仓库拣货中，预计 24 小时内发出。建议向客户说明原因并提供补偿券。" },
];

export const agentDecisions: AgentDecision[] = [
  { step: "场景识别", detail: "命中电商客服与售后 Agent，置信度 0.94。", status: "done" },
  { step: "意图拆解", detail: "用户需要订单查询、政策检索和客服回复生成。", status: "done" },
  { step: "工具编排", detail: "按 queryOrder -> searchPolicy -> generateCustomerReply 顺序执行。", status: "done" },
];

export const toolCallLogs: ToolCallLog[] = [
  { tool: "queryOrder", input: { orderId: "EAH20260624001" }, output: { status: "picking", etaHours: 24, warehouse: "华东一号仓" } },
  { tool: "searchPolicy", input: { keyword: "延迟发货补偿", scene: "after_sales" }, output: { policyId: "ASP-RETURN-7D", compensation: "8 元优惠券", citation: "售后政策第 4.2 条" } },
  { tool: "generateCustomerReply", input: { tone: "friendly", includeCoupon: true }, output: { reply: "很抱歉让您久等了，您的订单预计 24 小时内发出，我们将补发 8 元优惠券。" } },
];

export const structuredOutput = {
  scenario: "commerce_support",
  intent: "shipping_delay_reply",
  answer: "订单 EAH20260624001 当前在华东一号仓拣货中，预计 24 小时内发出。建议向客户致歉并补发 8 元优惠券。",
  tools: ["queryOrder", "searchPolicy", "generateCustomerReply"],
  citations: ["售后政策第 4.2 条"],
  confidence: 0.92,
};

export const tools: ToolDefinition[] = [
  {
    name: "queryOrder",
    scenario: "电商客服与售后 Agent",
    description: "根据订单 id 查询订单状态、商品、签收时间和退货相关信息。",
    inputExample: { orderId: "EAH20260624001" },
    outputExample: { status: "picking", productName: "Agent Plus 智能夹克", returnSupported: true },
  },
  {
    name: "queryProduct",
    scenario: "电商客服与售后 Agent",
    description: "根据商品 id 查询商品信息、尺码建议、库存和核心卖点。",
    inputExample: { productId: "SKU-AGENT-PLUS" },
    outputExample: { name: "Agent Plus 智能夹克", stock: 128, sizeAdvice: "标准版型，建议 M 码。" },
  },
  {
    name: "searchPolicy",
    scenario: "企业知识库 Agent / 电商客服与售后 Agent",
    description: "根据关键词从公司制度、企业文档和售后规则中检索相关规则。",
    inputExample: { keyword: "退货" },
    outputExample: { total: 3, matches: [{ id: "ASP-RETURN-7D", title: "7 天无理由退货" }] },
  },
  {
    name: "createTicket",
    scenario: "电商客服与售后 Agent / 企业流程自动化",
    description: "模拟创建工单，返回 ticketId、summary、priority、status 和 createdAt。",
    inputExample: { summary: "客户订单超过 48 小时未发货，需要客服跟进。", priority: "medium" },
    outputExample: { ticketId: "TCK-20260624-001", status: "created" },
  },
  {
    name: "analyzeJD",
    scenario: "招聘求职 JD 匹配 Agent",
    description: "用规则方式模拟 JD 与简历匹配分析，输出匹配分、匹配点、缺口和补强关键词。",
    inputExample: { jdText: "AI 应用开发工程师，需要 RAG、Agent、Tool Calling、Next.js、TypeScript、评测经验。", resumeText: sampleResume.summary },
    outputExample: { matchScore: 86, matchedKeywords: ["RAG", "Agent", "Tool Calling"], gaps: ["线上 A/B 评测"] },
  },
  {
    name: "generateCustomerReply",
    scenario: "电商客服与售后 Agent",
    description: "根据输入上下文生成 mock 客服回复，例如退货说明、尺码建议或物流解释。",
    inputExample: { type: "shipping_delay", orderId: "EAH20260624001", customerName: "张女士" },
    outputExample: { reply: "张女士您好，很抱歉让您久等了，您的订单预计 24 小时内发出。" },
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
  { id: "TC-001", scenario: "企业知识库 Agent", input: "差旅报销需要提前多久申请？", expectedTool: "searchPolicy", result: "pass", latency: "1.4s" },
  { id: "TC-002", scenario: "电商客服与售后 Agent", input: "订单三天未发货，帮我处理。", expectedTool: "queryOrder + searchPolicy", result: "pass", latency: "1.9s" },
  { id: "TC-003", scenario: "招聘求职 JD 匹配 Agent", input: "这个 AI 应用开发岗位和我的项目匹配吗？", expectedTool: "analyzeJD", result: "review", latency: "2.2s" },
  { id: "TC-004", scenario: "电商客服与售后 Agent", input: "帮客户创建一个退货工单。", expectedTool: "createTicket", result: "pass", latency: "1.6s" },
];
export const agentExamples: AgentExample[] = [
  {
    question: "公司报销需要什么材料？",
    expectedScenario: "enterprise",
    expectedIntent: "knowledge_qa",
    expectedTools: [],
    expectedNeedRag: true,
  },
  {
    question: "年假制度是什么？",
    expectedScenario: "enterprise",
    expectedIntent: "knowledge_qa",
    expectedTools: [],
    expectedNeedRag: true,
  },
  {
    question: "订单10001能不能退？",
    expectedScenario: "ecommerce",
    expectedIntent: "policy_check",
    expectedTools: ["queryOrder", "searchPolicy"],
    expectedNeedRag: true,
  },
  {
    question: "商品P001还有库存吗？",
    expectedScenario: "ecommerce",
    expectedIntent: "product_query",
    expectedTools: ["queryProduct"],
    expectedNeedRag: false,
  },
  {
    question: "客户说尺码不合适怎么回复？",
    expectedScenario: "ecommerce",
    expectedIntent: "after_sale_reply",
    expectedTools: ["generateCustomerReply"],
    expectedNeedRag: true,
  },
  {
    question: "这个 AI 应用开发工程师岗位和我的简历匹配吗？",
    expectedScenario: "recruitment",
    expectedIntent: "jd_match",
    expectedTools: ["analyzeJD"],
    expectedNeedRag: false,
  },
  {
    question: "帮我创建一个高优先级售后工单。",
    expectedScenario: "ecommerce",
    expectedIntent: "ticket_create",
    expectedTools: ["createTicket"],
    expectedNeedRag: false,
  },
  {
    question: "火星基地怎么申请？",
    expectedScenario: "general",
    expectedIntent: "general_chat",
    expectedTools: [],
    expectedNeedRag: false,
  },
];
