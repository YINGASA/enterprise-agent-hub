import type { KnowledgeDocument } from "@/types";

export type EnterpriseKnowledgePack = {
  id: string;
  title: string;
  description: string;
  packId: NonNullable<KnowledgeDocument["packId"]>;
  suitableQuestions: string[];
  documents: KnowledgeDocument[];
};

const updatedAt = "2026-06-25";
const createdAt = "2026-06-25T00:00:00.000Z";

function doc(input: Omit<KnowledgeDocument, "createdAt" | "updatedAt" | "source" | "owner" | "isDefault" | "sourceType">): KnowledgeDocument {
  return {
    ...input,
    createdAt,
    updatedAt,
    source: "system default knowledge pack",
    owner: "Enterprise Agent Hub",
    isDefault: true,
    sourceType: "default",
  };
}

export const enterpriseKnowledgePacks: EnterpriseKnowledgePack[] = [
  {
    id: "enterprise-it-admin",
    title: "企业 IT / 行政制度包",
    description: "覆盖电脑申请、VPN、账号权限、软件授权、入职设备、报销、请假和数据安全，适合展示企业知识库问答。",
    packId: "enterprise-policy",
    suitableQuestions: ["公司电脑怎么申请？", "VPN 权限申请失败怎么办？", "新员工入职设备多久能发？", "软件授权谁来审批？"],
    documents: [
      doc({ id: "SYS-IT-001", packId: "enterprise-policy", title: "笔记本电脑申请与归还制度", category: "IT 行政", tags: ["电脑申请", "资产", "审批", "归还"], summary: "说明员工申请公司笔记本电脑的条件、审批、发放和归还规则。", content: "适用范围：正式员工、实习生和项目外包人员如需使用公司笔记本电脑，应通过 IT 服务台提交申请。申请人需要填写使用场景、项目名称、预计使用周期和配置要求。普通办公电脑由直属主管审批，研发高性能设备还需项目负责人确认。IT 资产管理员在库存充足时 2 个工作日内发放；库存不足时应提供预计到货时间。临时借用默认 30 天，到期前需要申请延期。离职、项目结束或设备闲置时应在 3 个工作日内归还，并确认电源、鼠标、适配器等配件完整。" }),
      doc({ id: "SYS-IT-002", packId: "enterprise-policy", title: "VPN 与远程办公权限申请", category: "IT 安全", tags: ["VPN", "远程办公", "权限", "安全"], summary: "说明 VPN 权限开通、失败排查和安全要求。", content: "适用范围：需要远程访问内网系统、代码仓库、测试环境或客户支持平台的员工。申请 VPN 需要填写访问系统、业务原因、使用周期和直属主管。权限默认 90 天，到期自动回收。登录失败时先检查多因素认证、账号状态、网络代理和客户端版本；仍失败时提交 IT 工单并附错误截图。VPN 不得共享给他人，不得在公共电脑保存密码。访问生产环境需要额外审批，并记录操作原因。" }),
      doc({ id: "SYS-IT-003", packId: "enterprise-policy", title: "账号权限开通与回收流程", category: "IT 安全", tags: ["账号", "权限", "最小权限", "回收"], summary: "规定业务系统账号开通、变更和离职回收规则。", content: "账号权限遵循最小权限原则。新员工入职由 HR 触发账号创建，直属主管确认岗位角色后开通邮箱、协作工具和业务系统。跨部门访问客户数据、财务数据或生产环境时，需要数据负责人和安全负责人审批。岗位变更时应重新评估权限。离职当天必须关闭邮箱、VPN、代码仓库、生产系统和客户平台权限。所有共享账号原则上禁止使用，确需使用时必须有负责人和审计记录。" }),
      doc({ id: "SYS-IT-004", packId: "enterprise-policy", title: "软件授权与 SaaS 采购流程", category: "采购流程", tags: ["软件授权", "SaaS", "采购", "预算"], summary: "说明软件授权、SaaS 订阅和工具采购的审批要求。", content: "员工申请付费软件或 SaaS 工具时，应说明用途、使用人数、费用周期、替代方案和预算归属。个人效率工具由部门主管审批；团队级工具需要采购、财务和信息安全评估。涉及客户数据、源代码、单点登录或自动化集成的 SaaS 必须完成安全评审。采购完成后，管理员需要记录授权账号、到期时间和续费负责人。闲置授权应按月回收，避免重复购买。" }),
      doc({ id: "SYS-IT-005", packId: "enterprise-policy", title: "新员工入职设备准备流程", category: "人事行政", tags: ["入职", "设备", "账号", "行政"], summary: "说明新员工入职前设备、账号和工位准备。", content: "HR 确认入职日期后，应提前 3 个工作日通知行政和 IT。行政准备工位、门禁和办公用品；IT 根据岗位模板准备电脑、邮箱、协作工具、代码仓库或业务系统账号。研发、客服和销售岗位的权限模板不同，不得一刀切开通。新员工领取设备时需要签收资产清单，并完成信息安全培训。若入职当天设备未到位，IT 应提供备用设备或远程办公方案。" }),
      doc({ id: "SYS-IT-006", packId: "enterprise-policy", title: "报销付款与到账时效", category: "财务制度", tags: ["报销", "付款", "发票", "到账"], summary: "说明报销材料、审批和付款时效。", content: "员工报销需要提交电子发票、付款凭证、业务说明和必要的审批记录。差旅报销还需要行程单或会议安排。金额超过部门预算或项目预算时，需要项目负责人补充确认。财务每周二和周五集中付款，材料完整且审批通过的报销通常在 3 到 5 个工作日内到账。发票抬头、税号、金额或付款记录不一致会被退回补充。" }),
      doc({ id: "SYS-IT-007", packId: "enterprise-policy", title: "请假与调休申请规则", category: "人事制度", tags: ["请假", "调休", "年假", "审批"], summary: "说明请假、病假、年假和调休的申请边界。", content: "请假应提前在 HR 系统提交，事假超过 2 天需要部门负责人审批；连续年假超过 5 天建议提前 10 个工作日申请并提交交接计划。病假可以先口头报备，但返岗后 3 个工作日内需要补充医院证明或线上问诊记录。调休来源必须是已确认的加班记录，原则上 3 个月内使用。未审批直接缺勤会被记录为考勤异常。" }),
      doc({ id: "SYS-IT-008", packId: "enterprise-policy", title: "办公数据安全与外发规范", category: "信息安全", tags: ["数据安全", "外发", "脱敏", "客户数据"], summary: "说明客户数据、合同资料和源代码的外发限制。", content: "客户数据、合同资料、财务数据和源代码不得通过个人网盘、私人邮箱或未授权聊天工具外发。确需共享给供应商时，需要说明目的、范围、保留期限和接收方责任，并对手机号、证件号、地址、订单明细等字段做脱敏处理。外发文件应使用公司批准的共享工具，设置访问期限和水印。发现数据误发、设备遗失或异常下载时，应立即提交安全事件工单。" }),
    ],
  },
  {
    id: "enterprise-ecommerce-support",
    title: "电商客服售后政策包",
    description: "覆盖退货、换货、质量问题、发错货、优惠券、会员权益、物流异常和售后升级。",
    packId: "ecommerce-support",
    suitableQuestions: ["商品超过 7 天还能退吗？", "商品发错了怎么办？", "优惠券过期能补发吗？", "物流三天没更新怎么处理？"],
    documents: [
      doc({ id: "SYS-EC-001", packId: "ecommerce-support", title: "7 天无理由退货边界", category: "售后政策", tags: ["7天无理由", "退货", "签收", "拆封"], summary: "说明 7 天无理由退货的适用条件和例外情况。", content: "支持 7 天无理由的商品，从签收次日开始计算时效。商品需要保持不影响二次销售，吊牌、配件、包装和赠品齐全。已洗涤、明显穿着、损坏吊牌或缺少配件的商品通常不支持无理由退货。贴身衣物、定制商品、虚拟权益和一次性密封商品拆封后不适用。客服在判断前必须确认订单号、签收时间、是否拆封和商品类目，不能仅凭用户描述直接承诺可退。" }),
      doc({ id: "SYS-EC-002", packId: "ecommerce-support", title: "质量问题举证与处理", category: "售后流程", tags: ["质量问题", "举证", "退款", "换货"], summary: "说明质量问题需要收集的材料和处理方式。", content: "用户反馈质量问题时，客服应收集订单号、问题照片或视频、外包装照片、签收时间和问题描述。明显破损、开线、缺件、功能异常或发霉等情况可进入质量审核。审核通过后可提供退款、换货、补寄或维修方案。争议较大的问题应升级质检或售后主管，不要直接否定用户。若超过 7 天但能证明质量问题，仍可按质量售后处理。" }),
      doc({ id: "SYS-EC-003", packId: "ecommerce-support", title: "发错货与漏发处理规则", category: "售后流程", tags: ["发错货", "漏发", "补寄", "举证"], summary: "说明发错货、漏发配件和错尺码的处理流程。", content: "用户反馈发错货或漏发时，客服应核对订单明细、仓库出库记录和用户提供的商品照片。若确认发错款式、颜色、尺码或漏发配件，优先提供补寄或换货方案，必要时承担退回运费。若用户选择退款，应根据商品是否已使用和是否影响二次销售判断。客服话术应先致歉，再说明核实流程和预计处理时效。" }),
      doc({ id: "SYS-EC-004", packId: "ecommerce-support", title: "优惠券补发与失效规则", category: "会员权益", tags: ["优惠券", "补发", "会员", "权益"], summary: "说明优惠券过期、使用失败和补发边界。", content: "优惠券过期原则上不补发，但因系统故障、订单取消、商家缺货或客服误导造成未使用的，可以申请补发等值券。用户自行错过活动时间、未满足门槛或重复使用失败，不支持补发。补发优惠券需要记录原券 ID、用户 ID、订单号和补发原因。会员专属券不得转赠，补发后有效期通常为 7 天。" }),
      doc({ id: "SYS-EC-005", packId: "ecommerce-support", title: "会员权益与售后优先级", category: "会员服务", tags: ["会员", "优先级", "售后", "客服"], summary: "说明会员等级与售后响应优先级。", content: "普通用户售后工单在 1 个工作日内响应，银卡会员 8 小时内响应，金卡和黑卡会员优先进入主管队列。会员权益包括专属客服、生日券、优先换货和部分商品免运费退换。会员权益不能覆盖商品本身的退货边界，例如定制商品和影响二次销售商品仍需按规则判断。客服应解释权益范围，避免承诺超出政策的服务。" }),
      doc({ id: "SYS-EC-006", packId: "ecommerce-support", title: "物流异常处理 SOP", category: "物流售后", tags: ["物流异常", "超时", "丢件", "快递"], summary: "说明物流停滞、丢件和签收争议处理。", content: "物流超过 48 小时无更新，客服应先查询承运商轨迹并安抚用户。超过 72 小时仍无更新，可发起物流核查。确认丢件后，优先提供补发或退款；若用户急用，可建议重新下单并在原单核实后退款。签收争议需要收集签收凭证、驿站记录和用户说明。客服不得在未核实前承诺赔付，但应给出预计反馈时间。" }),
      doc({ id: "SYS-EC-007", packId: "ecommerce-support", title: "退款到账时效说明", category: "售后政策", tags: ["退款", "到账", "原路退回", "时效"], summary: "说明不同支付方式的退款到账时间。", content: "退款审核通过后，一般会原路退回。微信和支付宝通常 1 到 3 个工作日到账，银行卡可能需要 3 到 7 个工作日，信用卡账单显示时间以银行为准。若用户使用优惠券，退款金额按实付金额退回，优惠券是否返还取决于券规则。客服不能承诺立即到账，应说明审核、仓库验货和支付渠道处理三个阶段。" }),
      doc({ id: "SYS-EC-008", packId: "ecommerce-support", title: "售后投诉升级机制", category: "售后升级", tags: ["投诉", "升级", "工单", "主管"], summary: "说明高风险投诉和主管介入规则。", content: "出现辱骂、媒体曝光威胁、金额较大、重复投诉或平台介入风险时，应创建高优先级售后工单并升级主管。客服需要记录用户诉求、订单号、已沟通方案、证据材料和期望结果。主管应在 4 小时内首次响应。升级不代表直接满足所有诉求，而是由更高权限角色进行规则解释、补偿评估和风险控制。" }),
    ],
  },
  {
    id: "enterprise-ai-engineering",
    title: "AI 工程规范知识包",
    description: "覆盖 API Key 安全、RAG 引用、fallback、JSON 输出、Agent Router、Tool Calling、评测集和部署检查。",
    packId: "ai-engineering",
    suitableQuestions: ["Real API 失败时系统如何 fallback？", "RAG 命中少怎么排查？", "JSON 不合法怎么修复？", "部署前要检查哪些环境变量？"],
    documents: [
      doc({ id: "SYS-AI-001", packId: "ai-engineering", title: "API Key 安全与服务端调用规范", category: "安全规范", tags: ["API Key", "服务端", "环境变量", "脱敏"], summary: "说明模型 API Key 的安全管理和前端展示边界。", content: "API Key 必须只保存在服务端环境变量中，不能写入代码、README、截图或前端 bundle。浏览器端只能看到是否配置、长度和脱敏片段，不能看到完整密钥。请求日志不能打印 Authorization header。Vercel 部署时应在 Environment Variables 中配置 AI_API_KEY、AI_BASE_URL、AI_MODEL、AI_PROVIDER 和超时参数。本地代理变量不应配置到生产环境。" }),
      doc({ id: "SYS-AI-002", packId: "ai-engineering", title: "RAG 来源引用与可解释性规范", category: "RAG 规范", tags: ["RAG", "来源引用", "Top sources", "scoreReason"], summary: "说明 RAG 回答为什么需要展示来源和命中原因。", content: "RAG 回答必须让用户看到答案依据，包括文档标题、来源类型、category、tags、chunk 摘要、score 和 scoreReason。命中用户导入文档时应明显标识，因为这通常比默认知识库更贴近当前业务。默认知识库可作为补充来源。无来源时应给出边界说明，不应编造资料。scoreReason 可以解释关键词命中、标题命中、标签命中、知识包加权和用户文档加权。" }),
      doc({ id: "SYS-AI-003", packId: "ai-engineering", title: "fallback 与错误分类规范", category: "稳定性", tags: ["fallback", "network_error", "http_error", "json_parse_error"], summary: "说明 Real API 失败时如何保持产品可用。", content: "AI 应用应把错误分为配置错误、网络错误、HTTP 错误、返回结构错误和 JSON 解析错误。缺少 API Key 时应回退到 mock-agent；网络或 HTTP 失败时保留 Router、RAG 和工具结果；JSON 解析失败时可尝试 repair，失败后使用真实文本回答加 fallback structuredOutput。前端应展示 responseMode、fallbackReason、durationMs 和 errorType，帮助定位问题。" }),
      doc({ id: "SYS-AI-004", packId: "ai-engineering", title: "JSON 结构化输出与 repair 策略", category: "输出规范", tags: ["JSON", "repair", "structured output", "schema"], summary: "说明模型结构化输出不稳定时的容错策略。", content: "模型应被要求只返回 JSON，不返回 Markdown 或解释文字。字段至少包含 scenario、intent、answer、evidence、toolsUsed、sources、confidence、riskLevel 和 nextAction。解析时需要支持纯 JSON、代码块 JSON、前后附加文本和第一个完整对象提取。若解析失败，可以发起一次 repair 请求，要求模型保留语义并只返回合法 JSON。repair 仍失败时，产品应展示真实文本回答并保留 fallback structuredOutput。" }),
      doc({ id: "SYS-AI-005", packId: "ai-engineering", title: "Agent Router 设计规范", category: "Agent 规范", tags: ["Agent Router", "场景识别", "意图识别", "置信度"], summary: "说明 Router 如何判断场景、意图和是否需要 RAG。", content: "Agent Router 的职责是把用户问题映射为业务场景、任务意图、是否需要 RAG、需要哪些工具和置信度。规则版 Router 可以先覆盖高频关键词，例如报销、VPN、退货、订单、审批、RAG、fallback。Router 不应直接生成最终答案，而是生成可解释决策。后续接入真实模型时，也应保留规则兜底和评测验证，避免意图识别不可控。" }),
      doc({ id: "SYS-AI-006", packId: "ai-engineering", title: "Tool Calling 本地编排规范", category: "工具调用", tags: ["Tool Calling", "工具参数", "幂等", "缺失参数"], summary: "说明工具调用前的参数解析和边界处理。", content: "工具调用前必须检查关键参数。订单退款判断需要订单号、签收时间和是否拆封；商品库存查询需要商品编号或名称。缺少参数时不能静默使用 demo 数据，应要求用户补充信息。查询类工具应无副作用，创建工单等写操作需要幂等 ID、确认和权限。工具失败时要记录 failed step，并继续给出可理解的边界说明。" }),
      doc({ id: "SYS-AI-007", packId: "ai-engineering", title: "Agent Evaluation Dashboard 指标规范", category: "评测规范", tags: ["Evaluation", "passRate", "toolHitRate", "citationRate"], summary: "说明 Agent 评测面板应覆盖的指标。", content: "评测面板应统计总用例数、通过率、场景识别准确率、意图识别准确率、工具命中率、RAG 使用准确率、来源引用率、关键词命中率、fallback 率和平均耗时。失败用例需要 failureReasons 和 failureBuckets。评测集要覆盖自然问法、边界问法、缺参数问法和无答案问法。Mock 评测保证工程链路稳定，Real 评测验证模型接入质量。" }),
      doc({ id: "SYS-AI-008", packId: "ai-engineering", title: "Vercel 部署前检查清单", category: "部署规范", tags: ["Vercel", "部署", "环境变量", "安全"], summary: "说明部署前的构建、安全和环境变量检查。", content: "部署前应运行 typecheck 和 build，确认 .env.local 未被追踪，README 和 docs 不包含真实 Key 或本地代理地址。Vercel 项目需要配置 AI_API_KEY、AI_BASE_URL、AI_MODEL、AI_PROVIDER 和 AI_REQUEST_TIMEOUT_MS。生产环境不要配置本地 HTTPS_PROXY。部署后先验证 Mock 模式页面，再验证 /api/llm/health 和 /chat Real API。若 Real API 失败，应确认环境变量、模型名、网络访问和响应格式。" }),
    ],
  },
];

export const enterpriseKnowledgePackDocuments: KnowledgeDocument[] = enterpriseKnowledgePacks.flatMap((pack) => pack.documents);

export const recommendedKnowledgeQuestions = Array.from(new Set(enterpriseKnowledgePacks.flatMap((pack) => pack.suitableQuestions)));
