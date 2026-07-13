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
    "id": "EVAL-ENT-OPS-001",
    "question": "公司电脑怎么申请？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["电脑", "申请"],
    "category": "enterprise",
    "difficulty": "easy",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-OPS-002",
    "question": "VPN 权限申请失败怎么办？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["VPN", "权限"],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-OPS-003",
    "question": "新员工入职设备多久能发？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["入职", "设备"],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-OPS-004",
    "question": "软件授权由谁审批？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["软件", "审批"],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-OPS-005",
    "question": "报销审批通过后多久能到账？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["报销", "到账"],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-OPS-006",
    "question": "请假和调休怎么申请？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["请假", "调休"],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-OPS-007",
    "question": "客户数据外发前怎么脱敏？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["客户数据", "脱敏"],
    "category": "enterprise",
    "difficulty": "hard",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-ENT-OPS-008",
    "question": "员工离职后账号权限多久回收？",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["离职", "权限"],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-EC-POLICY-001",
    "question": "商品发错了怎么办？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": ["searchPolicy"],
    "expectedNeedRag": true,
    "expectedKeywords": ["searchPolicy"],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-EC-POLICY-002",
    "question": "优惠券过期能补发吗？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": ["searchPolicy"],
    "expectedNeedRag": true,
    "expectedKeywords": ["优惠券", "补发"],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-EC-POLICY-003",
    "question": "商品质量问题需要准备什么举证材料？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": ["searchPolicy"],
    "expectedNeedRag": true,
    "expectedKeywords": ["质量问题", "照片"],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-EC-POLICY-004",
    "question": "物流异常超过三天怎么处理？",
    "expectedScenario": "ecommerce",
    "expectedIntent": "policy_check",
    "expectedTools": ["searchPolicy"],
    "expectedNeedRag": true,
    "expectedKeywords": ["物流", "核查"],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-AI-001",
    "question": "如果模型返回的 JSON 不合法，系统应该怎么处理？",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "JSON",
      "解析",
      "repair"
    ],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-002",
    "question": "RAG 检索质量应该怎么评测？",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "RAG",
      "检索",
      "引用"
    ],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-003",
    "question": "Agent 工具调用要注意哪些参数和幂等问题？",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "Agent",
      "工具调用",
      "参数"
    ],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-004",
    "question": "API Key 为什么不能暴露在前端？",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "API Key",
      "前端",
      "环境变量"
    ],
    "category": "ai_engineering",
    "difficulty": "easy",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-005",
    "question": "fallback 机制在 AI 应用里有什么价值？",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "fallback",
      "异常",
      "降级"
    ],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-006",
    "question": "Prompt 设计应该包含哪些约束？",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "Prompt",
      "输出",
      "约束"
    ],
    "category": "ai_engineering",
    "difficulty": "easy",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-007",
    "question": "评测集设计要覆盖哪些边界问题？",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "评测",
      "测试集",
      "覆盖"
    ],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-AI-008",
    "question": "Agent Trace 应该展示哪些可观测性字段？",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "Trace",
      "可观测性",
      "耗时"
    ],
    "category": "ai_engineering",
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
    "id": "EVAL-V11-ORDER-001",
    "question": "\u8ba2\u5355 EAH20260618008 \u73b0\u5728\u662f\u4ec0\u4e48\u72b6\u6001\uff1f",
    "expectedScenario": "ecommerce",
    "expectedIntent": "order_query",
    "expectedTools": ["queryOrder"],
    "expectedNeedRag": false,
    "expectedKeywords": ["\u8ba2\u5355", "queryOrder"],
    "category": "ecommerce",
    "difficulty": "easy",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-V11-PRODUCT-001",
    "question": "\u5546\u54c1 P001 \u8fd8\u6709\u5e93\u5b58\u5417\uff1f",
    "expectedScenario": "ecommerce",
    "expectedIntent": "product_query",
    "expectedTools": ["queryProduct"],
    "expectedNeedRag": false,
    "expectedKeywords": ["\u5e93\u5b58", "queryProduct"],
    "category": "ecommerce",
    "difficulty": "easy",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-V11-AI-001",
    "question": "Real API \u5931\u8d25\u65f6\u7cfb\u7edf\u5982\u4f55 fallback\uff1f",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["fallback", "Real API", "\u9519\u8bef"],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V11-AI-002",
    "question": "RAG \u547d\u4e2d\u7528\u6237\u6587\u6863\u548c\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u65f6\u600e\u4e48\u89e3\u91ca\uff1f",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["RAG", "\u6765\u6e90", "scoreReason"],
    "category": "ai_engineering",
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
    "id": "EVAL-V12-TICKET-004",
    "question": "\u8bf7\u521b\u5efa\u4e00\u4e2a\u9ad8\u4f18\u5148\u7ea7\u5185\u90e8\u8ddf\u8fdb\u5de5\u5355",
    "expectedScenario": "enterprise",
    "expectedIntent": "ticket_create",
    "expectedTools": ["createTicket"],
    "expectedNeedRag": false,
    "expectedKeywords": ["\u5de5\u5355", "createTicket"],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-V12-RAG-005",
    "question": "\u6a21\u578b\u8f93\u51fa\u4e0d\u662f\u5408\u6cd5 JSON \u600e\u4e48\u5904\u7406",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["JSON", "repair", "fallback"],
    "category": "ai_engineering",
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
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["RAG", "\u68c0\u7d22"],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V12-RAG-008",
    "question": "\u7528\u6237\u6587\u6863\u548c\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u90fd\u547d\u4e2d\u65f6\u600e\u4e48\u89e3\u91ca\u6765\u6e90",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["RAG", "\u6765\u6e90", "scoreReason"],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V121-AI-001",
    "question": "\u6a21\u578b\u8f93\u51fa\u4e0d\u662f\u5408\u6cd5 JSON \u600e\u4e48\u5904\u7406",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["JSON", "repair", "fallback"],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V121-AI-002",
    "question": "RAG \u68c0\u7d22\u7ed3\u679c\u4e0d\u51c6\u600e\u4e48\u529e",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["RAG", "\u68c0\u7d22"],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V121-AI-003",
    "question": "Agent \u5de5\u5177\u8c03\u7528\u5931\u8d25\u600e\u4e48\u5904\u7406",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["Agent", "\u5de5\u5177\u8c03\u7528", "fallback"],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V121-AI-004",
    "question": "\u600e\u4e48\u8bbe\u8ba1 Agent \u8bc4\u6d4b\u96c6",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": ["Agent", "\u8bc4\u6d4b", "\u6d4b\u8bd5\u96c6"],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V15-RETRIEVER-001",
    "question": "json解析失败",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "JSON",
      "repair",
      "fallback"
    ],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V15-RETRIEVER-002",
    "question": "售后不想要了",
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
      "售后"
    ],
    "category": "ecommerce",
    "difficulty": "medium",
    "packId": "ecommerce-support"
  },
  {
    "id": "EVAL-V15-RETRIEVER-003",
    "question": "报销票据没了还能报销吗",
    "expectedScenario": "enterprise",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "报销",
      "票据",
      "发票"
    ],
    "category": "enterprise",
    "difficulty": "medium",
    "packId": "enterprise-policy"
  },
  {
    "id": "EVAL-V15-RETRIEVER-004",
    "question": "RAG 回答为什么需要来源引用？",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "来源",
      "引用"
    ],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  },
  {
    "id": "EVAL-V15-RETRIEVER-005",
    "question": "天气怎么样",
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
    "id": "EVAL-V15-RETRIEVER-006",
    "question": "embedding 和向量库有什么区别",
    "expectedScenario": "ai_engineering",
    "expectedIntent": "knowledge_qa",
    "expectedTools": [],
    "expectedNeedRag": true,
    "expectedKeywords": [
      "Embedding",
      "向量库",
      "RAG"
    ],
    "category": "ai_engineering",
    "difficulty": "medium",
    "packId": "ai-engineering"
  }
];
