import type { EvaluationCase } from "@/types";

export const evaluationCases: EvaluationCase[] = [
  {
    "id": "EVAL-ENT-001",
    "question": "公司报销需要什么材料？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "报销",
      "材料",
      "发票"
    ],
    "category": "enterprise",
    "difficulty": "easy",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-002",
    "question": "我出差回来想报销，应该准备哪些材料？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "报销",
      "行程单",
      "付款凭证"
    ],
    "category": "enterprise",
    "difficulty": "easy",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-003",
    "question": "年假连续休 6 天需要提前多久申请？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "年假",
      "提前",
      "工作日"
    ],
    "category": "enterprise",
    "difficulty": "easy",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-004",
    "question": "请假需要提前多久申请，病假要补什么证明？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "请假",
      "病假",
      "证明"
    ],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-005",
    "question": "加班之后怎么申请调休？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "加班",
      "调休",
      "申请"
    ],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-006",
    "question": "客户数据要外发给供应商，需要注意什么？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "客户数据",
      "脱敏",
      "权限"
    ],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-007",
    "question": "信息安全规范里账号和 Token 能不能共享？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "信息安全",
      "账号",
      "Token"
    ],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-008",
    "question": "合同盖章前需要哪些审批？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "合同",
      "审批",
      "法务"
    ],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-009",
    "question": "采购一个 SaaS 工具要走什么流程？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "采购",
      "供应商",
      "预算"
    ],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-010",
    "question": "项目立项评审要准备哪些内容？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "项目立项",
      "里程碑",
      "风险"
    ],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-011",
    "question": "P1 工单多久必须响应？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "工单",
      "SLA",
      "响应"
    ],
    "category": "enterprise",
    "difficulty": "easy",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-012",
    "question": "员工离职时账号权限要怎么处理？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "离职",
      "账号",
      "权限"
    ],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ECOM-001",
    "question": "订单10001能不能退？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": [
      "queryOrder",
      "searchPolicy"
    ],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "订单",
      "退货",
      "售后"
    ],
    "category": "ecommerce",
    "difficulty": "easy",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-002",
    "question": "客户买的衣服已经拆封了还能退吗？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": [
      "queryOrder",
      "searchPolicy"
    ],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "拆封",
      "退货",
      "二次销售"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-003",
    "question": "用户说尺码不合适但超过 7 天了，客服应该怎么回复？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "after_sale_reply",
    "expectedTools": [
      "generateCustomerReply"
    ],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "尺码",
      "客服",
      "回复"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-004",
    "question": "商品P001还有库存吗？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "product_query",
    "expectedTools": [
      "queryProduct"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "商品",
      "库存"
    ],
    "category": "ecommerce",
    "difficulty": "easy",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-005",
    "question": "这个商品缺货了要怎么跟客户沟通？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "product_query",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "商品",
      "库存"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-006",
    "question": "订单10002可以退款吗？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": [
      "queryOrder",
      "searchPolicy"
    ],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "订单",
      "退款",
      "退货"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-007",
    "question": "物流 48 小时没更新要怎么处理？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "order_query",
    "expectedTools": [
      "queryOrder"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "订单",
      "状态"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-008",
    "question": "用户反馈商品质量问题，需要走什么售后流程？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": ["searchPolicy"],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "质量问题",
      "售后",
      "凭证"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-009",
    "question": "客户投诉要求主管介入，应该怎么升级？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "ticket_create",
    "expectedTools": [
      "createTicket"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "工单",
      "优先级",
      "售后"
    ],
    "category": "ecommerce",
    "difficulty": "hard",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-010",
    "question": "帮我创建一个高优先级售后工单。",
    "expectedScenario": "ecommerce",
    "expectedIntent": "ticket_create",
    "expectedTools": [
      "createTicket"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "工单",
      "高优先级",
      "售后"
    ],
    "category": "ecommerce",
    "difficulty": "easy",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-011",
    "question": "换货流程里需要先确认库存吗？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "product_query",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "商品",
      "库存"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-012",
    "question": "客服回复里能不能承诺退款马上到账？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "after_sale_reply",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "客服",
      "回复",
      "售后"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-REC-001",
    "question": "这个 AI 应用开发工程师岗位和我的简历匹配吗？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "AI",
      "简历",
      "匹配"
    ],
    "category": "recruitment",
    "difficulty": "easy",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-002",
    "question": "这个项目如果面试 AI 应用开发岗，最应该讲哪些技术点？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "AI",
      "RAG",
      "Agent"
    ],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-003",
    "question": "我的简历还缺哪些 AI 项目关键词？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "简历",
      "AI",
      "关键词"
    ],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-004",
    "question": "大模型应用开发实习生会问哪些问题？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "大模型",
      "面试",
      "问题"
    ],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-005",
    "question": "AI Agent 开发实习生需要准备什么项目？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "AI",
      "Agent",
      "项目"
    ],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-006",
    "question": "RAG 知识库开发实习生会关注哪些能力？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "RAG",
      "知识库",
      "能力"
    ],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-007",
    "question": "前端 AI 应用开发实习生和我的项目匹配吗？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "前端",
      "AI",
      "匹配"
    ],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-008",
    "question": "Python AI 应用开发实习生需要补哪些后端能力？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "Python",
      "AI",
      "能力"
    ],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-009",
    "question": "帮我分析这个 JD 的核心要求。",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "JD",
      "核心要求",
      "岗位"
    ],
    "category": "recruitment",
    "difficulty": "easy",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-010",
    "question": "如何把这个项目包装成一页简历 bullet？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "简历",
      "项目",
      "关键词"
    ],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-011",
    "question": "面试官问这是不是只调 API，我该怎么回答？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "AI",
      "项目",
      "面试"
    ],
    "category": "recruitment",
    "difficulty": "hard",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-REC-012",
    "question": "岗位匹配评分应该看哪些维度？",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": [
      "analyzeJD"
    ],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "岗位",
      "匹配",
      "评分"
    ],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-AI-001",
    "question": "如果模型返回的 JSON 不合法，系统应该怎么处理？",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "JSON",
      "解析",
      "repair"
    ],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-002",
    "question": "RAG 检索质量应该怎么评测？",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "RAG",
      "检索",
      "引用"
    ],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-003",
    "question": "Agent 工具调用要注意哪些参数和幂等问题？",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "Agent",
      "工具调用",
      "参数"
    ],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-004",
    "question": "API Key 为什么不能暴露在前端？",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "API Key",
      "前端",
      "环境变量"
    ],
    "category": "general",
    "difficulty": "easy",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-005",
    "question": "fallback 机制在 AI 应用里有什么价值？",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "fallback",
      "异常",
      "降级"
    ],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-006",
    "question": "Prompt 设计应该包含哪些约束？",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "Prompt",
      "输出",
      "约束"
    ],
    "category": "general",
    "difficulty": "easy",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-007",
    "question": "评测集设计要覆盖哪些边界问题？",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "评测",
      "测试集",
      "覆盖"
    ],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-008",
    "question": "Agent Trace 应该展示哪些可观测性字段？",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "Trace",
      "可观测性",
      "耗时"
    ],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-FALL-001",
    "question": "火星基地怎么申请？",
    "expectedScenario": "general",
    "expectedIntent": "general_chat",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [],
    "category": "general",
    "difficulty": "easy",
    "packId": "fallback"
  },
  {
    "id": "EVAL-FALL-002",
    "question": "今天北京天气怎么样？",
    "expectedScenario": "general",
    "expectedIntent": "general_chat",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [],
    "category": "general",
    "difficulty": "easy",
    "packId": "fallback"
  },
  {
    "id": "EVAL-FALL-003",
    "question": "推荐一家附近好吃的火锅店。",
    "expectedScenario": "general",
    "expectedIntent": "general_chat",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [],
    "category": "general",
    "difficulty": "easy",
    "packId": "fallback"
  },
  {
    "id": "EVAL-FALL-004",
    "question": "股票明天会涨吗？",
    "expectedScenario": "general",
    "expectedIntent": "general_chat",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [],
    "category": "general",
    "difficulty": "medium",
    "packId": "fallback"
  },
  {
    "id": "EVAL-FALL-005",
    "question": "帮我写一首关于海边的诗。",
    "expectedScenario": "general",
    "expectedIntent": "general_chat",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [],
    "category": "general",
    "difficulty": "easy",
    "packId": "fallback"
  },
  {
    "id": "EVAL-FALL-006",
    "question": "这份知识库里有没有宇宙移民政策？",
    "expectedScenario": "general",
    "expectedIntent": "general_chat",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [],
    "category": "general",
    "difficulty": "medium",
    "packId": "fallback"
  },
  {
    "id": "EVAL-ECOM-013",
    "question": "我买了个东西，然后实物不太喜欢，想退款，怎么退",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": [
      "searchPolicy"
    ],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "订单号",
      "签收时间",
      "是否拆封",
      "7 天无理由",
      "申请售后"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-014",
    "question": "想退货，但是我不知道订单号怎么办",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": [
      "searchPolicy"
    ],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "订单号",
      "签收时间",
      "退货"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-015",
    "question": "这个商品还有货吗",
    "expectedScenario": "ecommerce",
    "expectedIntent": "product_query",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [
      "商品编号",
      "商品名称",
      "库存"
    ],
    "category": "ecommerce",
    "difficulty": "easy",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-ECOM-016",
    "question": "客户说不喜欢想退，客服怎么回复",
    "expectedScenario": "ecommerce",
    "expectedIntent": "after_sale_reply",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "订单号",
      "签收时间",
      "是否拆封",
      "通用回复"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-V11-IT-001",
    "question": "\u516c\u53f8\u7535\u8111\u600e\u4e48\u7533\u8bf7\uff1f",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["\u7535\u8111", "\u7533\u8bf7", "\u5ba1\u6279"],
    "category": "enterprise",
    "difficulty": "easy",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-V11-IT-002",
    "question": "VPN \u6743\u9650\u7533\u8bf7\u5931\u8d25\u600e\u4e48\u529e\uff1f",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["VPN", "\u6743\u9650", "\u7533\u8bf7"],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-V11-EC-001",
    "question": "\u5546\u54c1\u53d1\u9519\u4e86\u600e\u4e48\u529e\uff1f",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": ["searchPolicy"],
    "expectedNeedRag": true,
    "expectedKeywords": ["\u53d1\u9519\u8d27", "\u6362\u8d27", "\u552e\u540e"],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-V11-EC-002",
    "question": "\u4f18\u60e0\u5238\u8fc7\u671f\u80fd\u8865\u53d1\u5417\uff1f",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": ["searchPolicy"],
    "expectedNeedRag": true,
    "expectedKeywords": ["\u4f18\u60e0\u5238", "\u5931\u6548", "\u8865\u53d1"],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-V11-REC-001",
    "question": "\u5019\u9009\u4eba\u6709 Next.js \u548c RAG \u9879\u76ee\uff0c\u9002\u5408\u4ec0\u4e48\u5c97\u4f4d\uff1f",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": ["analyzeJD"],
    "expectedNeedRag": false,
    "expectedKeywords": ["AI", "RAG", "\u5c97\u4f4d"],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-V11-REC-002",
    "question": "AI \u4ea7\u54c1\u7ecf\u7406 JD \u770b\u91cd\u4ec0\u4e48\uff1f",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": ["analyzeJD"],
    "expectedNeedRag": false,
    "expectedKeywords": ["AI", "JD", "\u4ea7\u54c1"],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-V11-AI-001",
    "question": "Real API \u5931\u8d25\u65f6\u7cfb\u7edf\u5982\u4f55 fallback\uff1f",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["fallback", "Real API", "\u9519\u8bef"],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V11-AI-002",
    "question": "RAG \u547d\u4e2d\u7528\u6237\u6587\u6863\u548c\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u65f6\u600e\u4e48\u89e3\u91ca\uff1f",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["RAG", "\u6765\u6e90", "scoreReason"],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V12-RAG-001",
    "question": "\u53d1\u7968\u4e22\u4e86\u8fd8\u80fd\u62a5\u9500\u5417",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["\u62a5\u9500", "\u53d1\u7968"],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-V12-RAG-002",
    "question": "7\u5929\u65e0\u7406\u7531\u8fc7\u4e86\u8fd8\u80fd\u9000\u5417",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": ["searchPolicy"],
    "expectedNeedRag": true,
    "expectedKeywords": ["\u8ba2\u5355\u53f7", "\u7b7e\u6536\u65f6\u95f4", "\u662f\u5426\u62c6\u5c01"],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-V12-RAG-003",
    "question": "\u4e1c\u897f\u4e0d\u559c\u6b22\u60f3\u9000\u548b\u529e",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": ["searchPolicy"],
    "expectedNeedRag": true,
    "expectedKeywords": ["\u8ba2\u5355\u53f7", "\u7b7e\u6536\u65f6\u95f4", "\u662f\u5426\u62c6\u5c01"],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-V12-RAG-004",
    "question": "\u8fd9\u4e2a\u5c97\u4f4d\u548c\u6211\u7684\u9879\u76ee\u5339\u914d\u4e0d",
    "expectedScenario": "recruitment",
    "expectedIntent": "jd_match",
    "expectedTools": ["analyzeJD"],
    "expectedNeedRag": false,
    "expectedKeywords": ["AI", "\u5339\u914d"],
    "category": "recruitment",
    "difficulty": "medium",
    "packId": "recruitment-career"
  },
  {
    "id": "EVAL-V12-RAG-005",
    "question": "\u6a21\u578b\u8f93\u51fa\u4e0d\u662f\u5408\u6cd5 JSON \u600e\u4e48\u5904\u7406",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["JSON", "repair", "fallback"],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V12-RAG-006",
    "question": "\u660e\u5929\u5e7f\u5dde\u4f1a\u4e0b\u96e8\u5417",
    "expectedScenario": "general",
    "expectedIntent": "general_chat",
    "expectedTools": [],
    "expectedNeedRag": false,
    "expectedKeywords": [],
    "category": "general",
    "difficulty": "easy",
    "packId": "fallback"
  },
  {
    "id": "EVAL-V12-RAG-007",
    "question": "RAG \u68c0\u7d22\u547d\u4e2d\u5c11\u600e\u4e48\u6392\u67e5",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["RAG", "\u68c0\u7d22"],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V12-RAG-008",
    "question": "\u7528\u6237\u6587\u6863\u548c\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u90fd\u547d\u4e2d\u65f6\u600e\u4e48\u89e3\u91ca\u6765\u6e90",
    "expectedScenario": "general",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["RAG", "\u6765\u6e90", "scoreReason"],
    "category": "general",
    "difficulty": "medium",
    "packId": "ai-engineering"
  }


];
