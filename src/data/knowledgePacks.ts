import type { KnowledgeDocument, KnowledgePack } from "@/types";

export const knowledgePacks: KnowledgePack[] = [
  {
    "id": "enterprise-policy",
    "name": "企业制度知识库",
    "description": "覆盖报销、差旅、人事、安全、采购和项目流程。",
    "scenario": "enterprise"
  },
  {
    "id": "ecommerce-support",
    "name": "电商客服与售后知识库",
    "description": "覆盖退换货、退款、物流、投诉、话术和库存沟通。",
    "scenario": "ecommerce"
  },
  {
    "id": "recruitment-career",
    "name": "招聘求职知识库",
    "description": "覆盖 AI 应用开发岗位、简历包装和面试准备。",
    "scenario": "recruitment"
  },
  {
    "id": "ai-engineering",
    "name": "AI 应用工程规范知识库",
    "description": "覆盖 Prompt、RAG、Agent、JSON、fallback、安全和评测规范。",
    "scenario": "general"
  }
];

export const knowledgePackDocuments: KnowledgeDocument[] = [
  {
    "id": "KP-ENT-001",
    "packId": "enterprise-policy",
    "title": "报销制度",
    "category": "财务制度",
    "tags": [
      "报销",
      "发票",
      "材料",
      "费用"
    ],
    "summary": "规范员工费用报销的材料、时限和审批要求。",
    "content": "员工报销需遵循真实、合规、及时原则。差旅、交通、餐补、客户拜访等费用应在发生后 30 天内提交报销申请，材料包括电子发票、付款凭证、行程单、业务说明和必要的客户拜访记录。金额超过部门预算或涉及专项项目时，需要补充项目负责人确认。财务会校验发票抬头、税号、金额和付款记录，材料缺失会退回补充。报销申请应先由直属主管审批，再由财务复核，特殊费用需走额外审批。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-002",
    "packId": "enterprise-policy",
    "title": "差旅制度",
    "category": "行政制度",
    "tags": [
      "差旅",
      "出差",
      "审批",
      "交通"
    ],
    "summary": "说明出差申请、住宿交通标准和回程报销规则。",
    "content": "员工出差前应至少提前 3 个工作日在系统提交差旅申请，说明出差目的、城市、预计日期、预算和客户或项目背景。跨省出差、超过三天的行程或超预算安排需部门负责人审批。交通优先选择高铁二等座或经济舱，住宿应符合城市标准。差旅结束后需上传行程单、住宿发票、交通票据和出差结果说明。未提前审批的差旅可能无法报销，紧急出差需在返程后补充说明。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-003",
    "packId": "enterprise-policy",
    "title": "年假制度",
    "category": "人事制度",
    "tags": [
      "年假",
      "休假",
      "申请",
      "工作日"
    ],
    "summary": "说明年假额度、申请提前期和结转限制。",
    "content": "员工入职满一年后可按司龄享受带薪年假。年假应通过 HR 系统申请，连续休假 3 天以内建议提前 5 个工作日申请，连续休假超过 5 天需提前 10 个工作日申请，并确认工作交接计划。年假原则上在当年度使用，因项目原因无法休完的，可按公司通知申请结转。未经审批直接休假会按考勤异常处理。部门负责人需要平衡团队排班，避免多人同时休假影响交付。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-004",
    "packId": "enterprise-policy",
    "title": "请假制度",
    "category": "人事制度",
    "tags": [
      "请假",
      "病假",
      "事假",
      "审批"
    ],
    "summary": "覆盖事假、病假、紧急请假和证明材料要求。",
    "content": "请假类型包括事假、病假、调休、婚假和产检假等。事假应提前提交申请，超过 2 天需部门负责人审批；病假应在返岗后 3 个工作日内补充医院证明或线上问诊记录；紧急请假可先电话或即时通讯报备，但 24 小时内必须补交系统申请。请假期间应完成必要交接，说明联系人和待办事项。未审批缺勤会影响考勤记录。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-005",
    "packId": "enterprise-policy",
    "title": "加班调休制度",
    "category": "人事制度",
    "tags": [
      "加班",
      "调休",
      "工时",
      "审批"
    ],
    "summary": "说明加班申请、调休有效期和审批边界。",
    "content": "加班应以项目紧急交付、线上故障处理或客户支持为前提，需提前或事后 24 小时内在系统登记。加班记录需包含任务说明、时间段和负责人确认。调休应优先在 3 个月内使用，使用调休需提前申请并完成工作交接。非紧急工作不鼓励长期加班，团队负责人应关注工时健康。未经确认的加班记录可能无法转为调休。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-006",
    "packId": "enterprise-policy",
    "title": "信息安全规范",
    "category": "安全制度",
    "tags": [
      "信息安全",
      "权限",
      "账号",
      "脱敏"
    ],
    "summary": "规定账号、权限、设备和敏感信息保护要求。",
    "content": "所有员工必须使用个人账号访问内部系统，不得共享账号或将验证码、Token、Cookie、密钥发送到聊天工具。访问客户数据、合同、财务信息等敏感内容应遵循最小权限原则。外发文档前需确认接收方、文件范围和脱敏要求。办公设备应开启锁屏、磁盘加密和安全更新。发现账号异常、疑似钓鱼邮件或数据泄露，应立即通知安全负责人并提交安全事件工单。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-007",
    "packId": "enterprise-policy",
    "title": "客户数据保护规范",
    "category": "安全制度",
    "tags": [
      "客户数据",
      "隐私",
      "脱敏",
      "权限"
    ],
    "summary": "说明客户数据采集、使用、脱敏和留存要求。",
    "content": "客户数据只能用于合同约定和业务授权范围内的服务，不得下载到个人设备或用于非授权分析。导出演示数据、问题排查数据和训练样本时，必须删除姓名、手机号、证件号、地址、订单明细等可识别信息。需要跨部门共享客户数据时，应说明目的、范围、保留期限和负责人。数据留存到期后应删除或归档，涉及安全事件需保留审计记录。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-008",
    "packId": "enterprise-policy",
    "title": "合同审批流程",
    "category": "法务流程",
    "tags": [
      "合同",
      "审批",
      "法务",
      "盖章"
    ],
    "summary": "描述销售、采购和合作协议的审批节点。",
    "content": "合同发起人需提交合同草案、交易背景、金额、付款条款、交付范围和风险说明。标准合同由业务负责人和财务审批后进入法务复核；非标准条款、违约责任、数据安全条款或付款周期异常的合同需法务重点审查。合同审批完成后才能申请盖章，盖章版本应归档到合同系统。未完成审批的合同不得对外承诺或执行。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-009",
    "packId": "enterprise-policy",
    "title": "采购申请流程",
    "category": "采购流程",
    "tags": [
      "采购",
      "供应商",
      "预算",
      "验收"
    ],
    "summary": "说明采购申请、比价、审批和验收要求。",
    "content": "采购申请应说明采购目的、预算来源、规格、数量、期望交付时间和推荐供应商。超过预算阈值的采购需至少两家供应商比价，涉及软件订阅、云资源或外包服务时需补充安全和合规评估。采购审批通过后由采购或行政统一下单。到货或服务完成后，申请人需提交验收记录，财务依据合同、发票和验收结果付款。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-010",
    "packId": "enterprise-policy",
    "title": "项目立项流程",
    "category": "项目管理",
    "tags": [
      "项目立项",
      "需求",
      "里程碑",
      "风险"
    ],
    "summary": "说明项目从需求到立项评审的输入输出。",
    "content": "项目立项需提交业务目标、用户场景、范围边界、里程碑、资源需求、风险和验收标准。涉及跨部门协作的项目，应明确负责人、协作团队和沟通节奏。立项评审关注投入产出、交付风险、数据安全和后续运维成本。通过评审后项目进入执行阶段，重大范围变更需重新评估排期和资源。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-011",
    "packId": "enterprise-policy",
    "title": "工单处理 SLA",
    "category": "运营流程",
    "tags": [
      "工单",
      "SLA",
      "优先级",
      "响应"
    ],
    "summary": "定义内部工单优先级、响应时限和升级机制。",
    "content": "工单分为 P0、P1、P2、P3 四级。P0 代表核心系统不可用，应在 15 分钟内响应并建立应急群；P1 代表关键功能异常，应在 1 小时内响应；P2 为一般问题，需在 1 个工作日内响应；P3 为咨询或低优先级需求，可在 3 个工作日内处理。超过 SLA 未处理的工单会自动提醒负责人并升级给团队主管。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ENT-012",
    "packId": "enterprise-policy",
    "title": "员工入职与离职流程",
    "category": "人事流程",
    "tags": [
      "入职",
      "离职",
      "账号",
      "交接"
    ],
    "summary": "说明入职账号开通、资产领取和离职交接。",
    "content": "新员工入职前 HR 会发起入职流程，行政准备设备和工位，IT 根据岗位开通邮箱、协作工具和业务系统权限。试用期内需完成安全培训和制度学习。离职员工应至少提前提交离职申请，完成工作交接、资产归还、账号权限回收和资料归档。涉及客户、合同或代码仓库权限的岗位，离职当天必须完成权限关闭。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-001",
    "packId": "ecommerce-support",
    "title": "7 天无理由退货规则",
    "category": "售后规则",
    "tags": [
      "退货",
      "退款",
      "七天无理由",
      "签收"
    ],
    "summary": "说明签收后 7 天内退货的适用条件。",
    "content": "支持 7 天无理由退货的商品，应从用户签收次日开始计算时间。商品需保持不影响二次销售，吊牌、配件、包装和赠品齐全。用户需提供订单号和退货原因，客服应先确认商品类目、签收时间、是否拆封和是否属于特殊商品。超过 7 天、影响二次销售或缺少关键配件的订单，通常不支持无理由退货，但可根据质量问题另行判断。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-002",
    "packId": "ecommerce-support",
    "title": "已拆封商品处理规则",
    "category": "售后规则",
    "tags": [
      "拆封",
      "二次销售",
      "退货",
      "特殊商品"
    ],
    "summary": "说明拆封后商品能否退换的判断标准。",
    "content": "已拆封商品不一定完全不能退，关键看是否影响二次销售、是否属于质量问题、是否有试穿试用限制。服饰类商品可合理试穿，但不得洗涤、损坏吊牌或留下明显使用痕迹。贴身衣物、定制商品、虚拟权益和一次性密封商品拆封后通常不支持无理由退货。客服需温和解释规则，并引导用户提供照片或视频材料。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-003",
    "packId": "ecommerce-support",
    "title": "质量问题处理流程",
    "category": "售后流程",
    "tags": [
      "质量问题",
      "举证",
      "换货",
      "退款"
    ],
    "summary": "说明质量问题的举证、审核和处理方式。",
    "content": "用户反馈质量问题时，客服应收集订单号、问题描述、商品照片或视频、外包装照片和签收时间。初步判断属于破损、错发、漏发、明显做工缺陷或功能异常的，可进入质量审核流程。审核通过后可提供退货退款、补寄、换货或维修方案。争议较大的问题应升级质检或售后主管，避免直接否定用户。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-004",
    "packId": "ecommerce-support",
    "title": "尺码不合适处理流程",
    "category": "售后流程",
    "tags": [
      "尺码",
      "换货",
      "退货",
      "客服回复"
    ],
    "summary": "说明尺码不合适时的客服处理流程。",
    "content": "尺码不合适属于高频售后场景。客服应先确认用户身高、体重、常穿尺码、商品款式和是否试穿洗涤。如果在 7 天无理由范围内且不影响二次销售，可引导用户退货或换货；超过时限时，可根据商品状态、库存和会员等级评估一次性补偿或换码方案。回复要避免责备用户，可提供尺码表和下次购买建议。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-005",
    "packId": "ecommerce-support",
    "title": "退款时效说明",
    "category": "售后规则",
    "tags": [
      "退款",
      "时效",
      "原路退回",
      "审核"
    ],
    "summary": "说明退款审核和到账时效。",
    "content": "退款时效取决于售后类型、仓库验收和支付渠道。仅退款申请通常在审核通过后 1 到 3 个工作日处理；退货退款需等待仓库签收并验收商品，通常在 3 到 7 个工作日完成。退款会原路退回到用户支付账户，银行或支付平台可能存在额外到账延迟。客服应说明当前节点，避免承诺绝对到账时间。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-006",
    "packId": "ecommerce-support",
    "title": "换货流程",
    "category": "售后流程",
    "tags": [
      "换货",
      "库存",
      "寄回",
      "补发"
    ],
    "summary": "说明换货申请、库存锁定和补发流程。",
    "content": "换货前客服需确认订单状态、商品是否支持换货、目标尺码或颜色是否有库存。用户提交换货申请后，应按系统地址寄回商品并上传物流单号。仓库签收验收后，系统会锁定新商品库存并安排补发。如果目标商品缺货，客服应提供等待、退款或更换同价商品等方案。换货过程中应持续告知用户节点。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-007",
    "packId": "ecommerce-support",
    "title": "售后工单分级",
    "category": "售后流程",
    "tags": [
      "工单",
      "优先级",
      "投诉",
      "升级"
    ],
    "summary": "定义售后工单优先级和处理时限。",
    "content": "售后工单按影响程度分为高、中、低优先级。涉及投诉、负面评价风险、大额订单、重复沟通超过三次或物流长时间异常的，应标记为高优先级并升级主管。普通退换货咨询为中优先级，尺码建议和规则解释为低优先级。高优先级工单应在 2 小时内首次响应，并在当天给出处理方案或下一步时间点。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-008",
    "packId": "ecommerce-support",
    "title": "物流异常处理",
    "category": "物流售后",
    "tags": [
      "物流",
      "延迟",
      "丢件",
      "签收"
    ],
    "summary": "说明物流停滞、丢件和异常签收处理。",
    "content": "当物流超过 48 小时无更新，客服应先查询物流轨迹并联系承运商核实。疑似丢件、错送或异常签收的订单，需要创建物流异常工单，记录订单号、收件信息、轨迹截图和用户反馈。若确认物流责任，可为用户安排补发或退款。客服回复应说明正在核实，给出预计反馈时间，避免让用户重复提供信息。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-009",
    "packId": "ecommerce-support",
    "title": "客户投诉升级流程",
    "category": "客服流程",
    "tags": [
      "投诉",
      "升级",
      "安抚",
      "补偿"
    ],
    "summary": "说明投诉场景的升级、安抚和补偿边界。",
    "content": "客户明确表达投诉、要求主管介入、威胁差评或平台仲裁时，客服应升级投诉流程。第一步是安抚情绪并复述问题，第二步确认订单和历史沟通，第三步给出可执行方案。补偿应符合授权范围，超过客服权限需主管审批。所有投诉都应记录原因、处理过程和复盘结论，用于改进商品、物流或客服话术。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-010",
    "packId": "ecommerce-support",
    "title": "客服话术规范",
    "category": "客服规范",
    "tags": [
      "话术",
      "回复",
      "边界",
      "安抚"
    ],
    "summary": "规定客服回复的语气、结构和禁用表达。",
    "content": "客服回复应包含称呼、问题确认、规则说明、解决方案和下一步时间点。语气要清晰、温和、可执行，避免使用“不能处理”“你自己看规则”等刺激性表达。涉及退款、赔付和时效时，不应做超出系统能力的承诺。对于规则限制，应先表达理解，再说明原因，并提供替代方案。复杂问题可转人工或创建工单。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-011",
    "packId": "ecommerce-support",
    "title": "商品尺码推荐规则",
    "category": "商品规则",
    "tags": [
      "尺码",
      "推荐",
      "身高",
      "体重"
    ],
    "summary": "说明根据身高体重和款式推荐尺码的方法。",
    "content": "尺码推荐应结合商品版型、弹力、用户身高体重、肩宽胸围和穿着偏好。宽松款可按常穿尺码选择，修身款建议参考胸围和肩宽。客服无法保证百分百合身，应提示用户以尺码表为准，并说明不同批次可能存在轻微误差。若用户在两个尺码之间，建议根据偏好选择大一码或咨询人工。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-ECOM-012",
    "packId": "ecommerce-support",
    "title": "库存与缺货沟通规则",
    "category": "商品规则",
    "tags": [
      "库存",
      "缺货",
      "补货",
      "替代"
    ],
    "summary": "说明库存不足和缺货时的沟通方式。",
    "content": "当商品库存不足或售罄时，客服应先确认系统实时库存，再说明是否有补货计划。若无明确补货时间，不应承诺具体日期。可以提供到货提醒、相似商品推荐、换色换码或退款方案。对已付款但无法发货的订单，应主动道歉并提供取消退款或等待补货选项。库存沟通要准确，避免造成二次投诉。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-001",
    "packId": "recruitment-career",
    "title": "AI 应用开发工程师 JD",
    "category": "岗位说明",
    "tags": [
      "AI",
      "应用开发",
      "RAG",
      "Agent"
    ],
    "summary": "说明 AI 应用开发工程师的职责和能力要求。",
    "content": "AI 应用开发工程师需要把大模型能力落地到真实业务系统。核心职责包括设计 RAG 知识库问答、Agent Router、Tool Calling、结构化输出、API 接入、评测与可观测性。候选人应熟悉 TypeScript 或 Python，理解 Prompt 设计、模型调用、错误处理和前后端集成。优秀项目经历应展示完整链路，而不只是调用一次 API。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-002",
    "packId": "recruitment-career",
    "title": "大模型应用开发实习生 JD",
    "category": "岗位说明",
    "tags": [
      "大模型",
      "实习生",
      "Prompt",
      "API"
    ],
    "summary": "说明大模型应用开发实习岗位关注点。",
    "content": "大模型应用开发实习生通常参与 Prompt 优化、业务数据整理、API 调用封装、简单 RAG 流程和 Demo 页面开发。岗位看重学习能力、工程基础和项目表达能力。简历中应突出 Next.js、TypeScript、Python、OpenAI-compatible API、DeepSeek、JSON 输出、fallback 和评测意识。面试可能会问模型输出不稳定如何处理。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-003",
    "packId": "recruitment-career",
    "title": "AI Agent 开发实习生 JD",
    "category": "岗位说明",
    "tags": [
      "Agent",
      "Router",
      "工具调用",
      "实习生"
    ],
    "summary": "说明 AI Agent 开发实习生能力模型。",
    "content": "AI Agent 开发实习生需要理解 Agent 的任务拆解、路由、工具选择和执行轨迹展示。岗位会关注是否能把用户问题识别为场景和意图，是否能设计工具参数、处理失败、记录步骤并输出结构化结果。项目中如果能展示 Router、RAG、Tools、LLM、fallback 和 Evaluation Dashboard，会比单纯聊天页面更有说服力。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-004",
    "packId": "recruitment-career",
    "title": "RAG 知识库开发实习生 JD",
    "category": "岗位说明",
    "tags": [
      "RAG",
      "知识库",
      "检索",
      "引用"
    ],
    "summary": "说明 RAG 知识库开发岗位要求。",
    "content": "RAG 知识库开发实习生需要理解文档解析、切片、关键词或向量检索、TopK 召回、引用来源和答案生成。当前项目使用 keyword mock RAG，但清晰保留了从文档到 chunk 到 source 的接口，后续可替换为 Embedding、pgvector、Qdrant 和 Rerank。面试时应诚实说明当前不是向量库，并解释升级路径。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-005",
    "packId": "recruitment-career",
    "title": "前端 AI 应用开发实习生 JD",
    "category": "岗位说明",
    "tags": [
      "前端",
      "Next.js",
      "AI应用",
      "UI"
    ],
    "summary": "说明前端 AI 应用岗位如何看项目。",
    "content": "前端 AI 应用开发实习生除了页面能力，还需要理解 AI 工作流展示。项目应体现清晰的输入区、结果区、Agent Trace、JSON 面板、错误状态和响应式布局。Next.js App Router、TypeScript 类型、Tailwind CSS 和 API Route 经验都能加分。面试官会关注你是否能把复杂 AI 流程做成可理解、可演示的产品界面。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-006",
    "packId": "recruitment-career",
    "title": "Python AI 应用开发实习生 JD",
    "category": "岗位说明",
    "tags": [
      "Python",
      "API",
      "后端",
      "评测"
    ],
    "summary": "说明 Python AI 应用岗位与当前项目的迁移关系。",
    "content": "Python AI 应用开发实习生通常负责模型 API 封装、数据处理、RAG 服务、工具函数和评测脚本。虽然当前项目使用 TypeScript 实现，但架构思想可迁移到 Python：Router、Retriever、Tool Layer、LLM Client、Evaluation Suite 都可以成为独立模块。简历中可强调工程分层和可替换设计。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-007",
    "packId": "recruitment-career",
    "title": "面试问题分类",
    "category": "面试准备",
    "tags": [
      "面试",
      "问题",
      "项目讲解",
      "追问"
    ],
    "summary": "整理 AI 应用开发岗位常见面试问题。",
    "content": "AI 应用开发面试常见问题包括：为什么要做 RAG，如何切片，如何处理模型 JSON 不稳定，如何设计工具调用，如何避免 API Key 泄露，如何评测 Agent，Mock 和 Real 模式为什么共存。如果面试官追问是不是只调 API，应回答真实模型只是生成层，项目还包含路由、检索、工具、结构化、fallback 和评测闭环。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-008",
    "packId": "recruitment-career",
    "title": "项目经历包装规则",
    "category": "简历优化",
    "tags": [
      "项目经历",
      "包装",
      "亮点",
      "结果"
    ],
    "summary": "说明如何包装 AI 应用项目经历。",
    "content": "项目经历应按背景、目标、技术方案、个人贡献和结果组织。不要夸大为生产系统或真实向量库，应诚实说明 mock 数据、keyword RAG 和本地工具编排。亮点可以写完整 Agent Pipeline、DeepSeek/OpenAI-compatible 接入、JSON repair、fallback、代理诊断和 Evaluation Dashboard。结果应量化，如 50 条评测用例、Mock 完整评测通过率。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-009",
    "packId": "recruitment-career",
    "title": "简历关键词优化规则",
    "category": "简历优化",
    "tags": [
      "简历",
      "关键词",
      "RAG",
      "Tool Calling"
    ],
    "summary": "说明 AI 应用开发简历关键词布局。",
    "content": "简历关键词应覆盖岗位 JD 中的技术栈和业务能力，例如 RAG、Agent Router、Tool Calling、OpenAI-compatible API、DeepSeek、Prompt、JSON Schema、fallback、Evaluation、Next.js、TypeScript、Python。关键词应自然出现在项目描述中，并和具体实现对应，避免堆词。每条 bullet 尽量包含技术动作和结果。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-REC-010",
    "packId": "recruitment-career",
    "title": "岗位匹配评分规则",
    "category": "求职分析",
    "tags": [
      "岗位匹配",
      "评分",
      "差距",
      "建议"
    ],
    "summary": "说明用规则方式做 JD 与简历匹配。",
    "content": "岗位匹配评分可从技术关键词、项目经验、业务场景、工程质量和表达清晰度五个维度计算。匹配点包括 RAG、Agent、Tool Calling、API 接入和评测；缺口可能包括真实向量库、生产数据库、权限审计和线上监控。建议输出应包含补强关键词、可改写 bullet 和面试讲解重点。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-AI-001",
    "packId": "ai-engineering",
    "title": "Prompt 设计规范",
    "category": "AI工程规范",
    "tags": [
      "Prompt",
      "系统提示词",
      "约束",
      "输出"
    ],
    "summary": "说明 Prompt 的角色、上下文和输出约束设计。",
    "content": "Prompt 设计应明确角色、任务、输入上下文、输出格式和边界。对于企业 Agent，应要求模型基于 Router、RAG 和工具结果回答，不得编造不存在的数据。结构化输出场景要约束字段、类型、长度和枚举值。Prompt 不应包含真实 API Key 或敏感配置。复杂任务应拆成路由、检索、工具和生成步骤，便于调试和评测。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-AI-002",
    "packId": "ai-engineering",
    "title": "RAG 检索质量规范",
    "category": "AI工程规范",
    "tags": [
      "RAG",
      "检索",
      "召回",
      "引用",
      "Embedding",
      "向量库"
    ],
    "summary": "说明 RAG 检索质量的评估维度。",
    "content": "RAG 质量不能只看答案是否流畅，还要看召回是否相关、来源是否准确、引用是否覆盖关键结论、无资料时是否拒答。关键词检索适合早期 Demo，向量检索适合语义匹配，Rerank 可提升 TopK 质量。Embedding 是把文本转换成可计算相似度的向量表示，向量库用于存储向量、执行相似度检索和管理索引；两者通常一起用于语义召回，但不能替代来源引用和低置信边界。评测集应覆盖同义问法、边界问题和无答案问题，避免只测模板问题。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-AI-003",
    "packId": "ai-engineering",
    "title": "Agent 工具调用规范",
    "category": "AI工程规范",
    "tags": [
      "Agent",
      "工具调用",
      "参数",
      "幂等"
    ],
    "summary": "说明 Agent 调用业务工具时的设计原则。",
    "content": "Agent 工具调用应明确工具名称、输入参数、输出结构、错误类型和幂等性。查询类工具应无副作用，创建工单、退款等写操作需要确认和权限控制。工具失败不能让页面崩溃，应记录 failed step 和错误信息。真实模型 tool_calls 接入前，可先用本地规则编排工具，保证业务流程可解释。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-AI-004",
    "packId": "ai-engineering",
    "title": "JSON 结构化输出规范",
    "category": "AI工程规范",
    "tags": [
      "JSON",
      "结构化输出",
      "Schema",
      "解析"
    ],
    "summary": "说明模型输出 JSON 的稳定性要求。",
    "content": "结构化输出应定义字段名称、类型、必填项和枚举值，例如 scenario、intent、answer、evidence、toolsUsed、sources、confidence、riskLevel、nextAction。模型可能返回 Markdown、截断 JSON 或字符串未闭合，因此服务端需要 safeParseJson、代码块剥离、对象提取和 repair 策略。解析失败时可使用真实文本回答加 fallback structured output。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-AI-005",
    "packId": "ai-engineering",
    "title": "fallback 与异常处理规范",
    "category": "AI工程规范",
    "tags": [
      "fallback",
      "异常",
      "降级",
      "可用性"
    ],
    "summary": "说明 AI 应用在失败时如何保持可用。",
    "content": "AI 应用常见失败包括缺少 API Key、网络超时、HTTP 错误、模型限流、返回结构异常和 JSON 解析失败。系统应区分 config、network、http、parse 等错误类型，并给前端展示可读诊断。Mock fallback 可以保证演示可用，真实文本 fallback 可以保留模型回答价值。失败信息应进入评测指标和日志。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-AI-006",
    "packId": "ai-engineering",
    "title": "API Key 安全规范",
    "category": "AI工程规范",
    "tags": [
      "API Key",
      "安全",
      "环境变量",
      "脱敏"
    ],
    "summary": "说明 API Key 的服务端管理和脱敏展示。",
    "content": "API Key 必须通过服务端环境变量读取，不应写入代码、README、截图或前端 bundle。浏览器只能看到是否存在、长度和脱敏片段，不能看到完整 Key。本地 `.env.local` 应加入 `.gitignore`。部署平台应在控制台配置环境变量。诊断接口不能返回密钥原文，日志也不能打印 Authorization header。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-AI-007",
    "packId": "ai-engineering",
    "title": "评测集设计规范",
    "category": "AI工程规范",
    "tags": [
      "评测",
      "测试集",
      "指标",
      "覆盖"
    ],
    "summary": "说明 Agent 评测集如何设计。",
    "content": "评测集应覆盖核心场景、自然问法、边界问法、缺少参数和无答案问题。指标包括场景识别准确率、意图识别准确率、工具命中率、RAG 使用准确率、来源引用率、关键词命中率、fallback 率和平均耗时。评测不应只追求 100%，失败 case 的原因分桶同样重要，可以指导 Router、RAG 和 Prompt 的改进。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  },
  {
    "id": "KP-AI-008",
    "packId": "ai-engineering",
    "title": "日志与可观测性规范",
    "category": "AI工程规范",
    "tags": [
      "日志",
      "可观测性",
      "Trace",
      "诊断"
    ],
    "summary": "说明 Agent Trace 和诊断信息的展示边界。",
    "content": "企业 AI 应用需要展示每一步输入、输出、耗时和状态，包括 Router 决策、RAG 召回、工具调用、LLM 生成和 fallback。日志应帮助定位问题，但不能泄露密钥和隐私。前端可展示 requestMode、responseMode、provider、model、durationMs、errorType、parseError 和 rawContentPreview。生产系统还需要请求 ID、用户权限和审计日志。",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-25",
    "source": "mock-knowledge-pack",
    "owner": "Enterprise Agent Hub",
    "isDefault": true
  }
];
