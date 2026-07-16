# Enterprise Agent Hub 项目交接文档

最后更新：2026-07-16（Asia/Shanghai）

这份文档写给一个完全没有上下文的新会话。请先读完，再执行任何 Git、发布或服务器操作。

## V2.1.0 当前状态（2026-07-16）

V2.1.0 **Conversation Context Manager** 已在本地 feature 分支完成四个阶段：Context Foundation、Smart History Selection、Rolling Summary 与最终安全回归。

- 当前分支：`feature/v2.1.0-context-manager`
- 当前 HEAD：接手时请执行 `git rev-parse HEAD` 实时核对；本文档的后续文档提交会推进 HEAD。
- 阶段三提交：`92cb77e feat(context): add rolling conversation summaries`
- 阶段四安全修复：`c2ff6e8 fix(context): harden conversation revision safety`
- 当前本地验证：36 个单测文件、148/148；Full Mock 80/80、100%；E2E 29/29；typecheck、build 与 `git diff --check` 通过。
- 尚未 merge、tag、push 或部署。不要把该分支称为已发布版本。

V2.1.0 将候选历史交由服务端统一规划：Router、RAG、Tool、规则式历史选择、Rolling Summary 与 Token Budget 共同形成唯一的 Context Plan。摘要是可选的浏览器本地 Conversation 状态，使用 cursor 增量推进；Mock、Real、Streaming 与非 Streaming 共用同一计划和 Summary Patch。没有新增第二次模型调用、数据库、长期记忆或跨会话记忆。

发布前仍需用户明确授权 merge、tag、push 和部署；本地稳定标签建议为 `v2.1.0-stable`，但当前尚未创建。

## 1. 新会话开始时必须先做什么

1. 读取全局记忆：
   - `C:\Users\LENOVO\.codex\memories\PROFILE.md`
   - `C:\Users\LENOVO\.codex\memories\ACTIVE.md`
2. 进入项目：`E:\codex\enterprise-agent-hub`
3. 只读核对：

```powershell
git status
git branch --show-current
git log --oneline -12
git tag --list "v2.0*" --sort=version:refname
git branch -vv
git rev-parse master
git rev-parse origin/master
```

4. 不读取或输出 `.env.local` 内容。
5. 未经用户明确要求，不要 merge、push、部署或操作腾讯云。

## 2. 我们在做什么

项目当前主线是 Enterprise Agent Hub V2：企业内部知识库问答、制度与材料查询、业务流程自动化、RAG、业务工具和可追踪评测。

最近完成的任务是 **V2.0.4：Product Scenario Focus & Recruitment Agent Retirement**。目标不是删除所有包含招聘关键词的数据，而是把招聘求职 Agent 从正式产品组合中软下线，同时保证旧 Conversation、Chat History、Evaluation、Ops、Feedback 和用户自定义知识仍能安全读取。

V2 系列此前已经依次完成：

| 版本 | Commit | 核心能力 |
| --- | --- | --- |
| V2.0.0 | `14d149f3125b15f808bd796f1dc6f615931f4515` | 当前会话多轮上下文 |
| V2.0.1 | `6151d31af3634e733b35040ec016e5e536a58fee` | 双栏连续聊天工作台与会话管理 |
| V2.0.2 | `6d079c46e54e53355330c04496a3736bf37d8afd` | NDJSON 流式回答、停止生成、失败重试 |
| V2.0.3 | `2932345be7da68b3188f894a5820376e6fa22c2d` | 回答复制、最新回答重新生成、最新问题编辑重发 |
| V2.0.4 | `1699ad2e291ca0b7e23a174bf0d5f72b910fe327` | 企业场景聚焦与招聘求职 Agent 软下线 |

对应本地稳定标签 `v2.0.0-stable` 至 `v2.0.4-stable` 均已创建。

## 3. 当前准确状态

- 当前分支：`feature/v2.0.4-scenario-focus`
- 当前 HEAD：`1699ad2e291ca0b7e23a174bf0d5f72b910fe327`
- 当前稳定标签：`v2.0.4-stable`，指向上述 HEAD
- 当前应用版本：`2.0.4`
- 创建本交接文档之前工作区为 clean；创建后预计只有 `HANDOFF.md` 为未跟踪文件，尚未提交。
- 本地 `master`：`3a2f2000fbf610cff6e3539aecd9776b6ae14fb7`（V1.12.2）
- 本地缓存的 `origin/master`：`9856a0b8ce70ad460d79682d120bf4e8830bfa7e`（V1.12.1 merge）
- 当前 V2.0.4 分支比本地 `master` 多 8 个提交，包含 V1.12.3、V1.12.4、V1.12.5 和 V2.0.0～V2.0.4。
- 不要声称 V2 已合并到 `master`；事实并非如此。
- 根据最近任务说明，V2.0.0～V2.0.4 尚未 push、尚未部署。
- 最近用户提供的线上基线是 V1.12.5，但本次没有连接服务器重新验证，不能把它当成本轮实测结论。
- 线上地址历史记录：`http://43.136.104.95`
- 服务器项目目录历史记录：`/var/www/enterprise-agent-hub`
- PM2 进程名：`enterprise-agent-hub`

## 4. V2.0.4 已完成什么

### 产品入口

- 首页、`/scenarios`、Chat 推荐问题、`/tools`、默认 Knowledge Packs、Evaluation 活动分类、About 和当前产品文档均不再把招聘求职 Agent 作为正式能力。
- 当前产品聚焦企业制度与流程、订单与售后、AI 工程规范、RAG、业务工具和评测。
- Tools 内链顺手补了清晰的键盘焦点态，没有做大规模 UI 重构。

### Router、Mock 与 Real 输出边界

- 新增唯一活动场景白名单：`enterprise`、`ecommerce`、`ai_engineering`、`general`。
- 新招聘/简历/面试类问题会降级为 `general + knowledge_qa`。
- 这类问题仍可检索用户自己导入并启用的文档，但不会选择 `recruitment`、`jd_match` 或 `analyzeJD`。
- 当前问题始终优先于旧会话上下文；旧招聘话题不能重新激活下线场景。
- Real 模型结构化输出若返回旧 scenario、intent 或 tool，会被服务端二次过滤。
- `runToolDemo("analyzeJD")` 只保留为 legacy 安全拒绝分支，返回 failed，不再执行招聘分析。

### 默认知识与 Evaluation

- 从两组内置演示数据中移除共 18 篇招聘相关默认文档。
- 当前默认 Knowledge Packs 为 3 个：企业制度、电商售后、AI 工程规范。
- 用户上传或粘贴的招聘、简历、面试类文档不会被删除、改写或按关键词过滤。
- 原 Full Mock 中有 16 条招聘场景用例，已经全部替换为企业制度、IT/行政、报销审批、订单、售后、工具和 RAG 用例。
- Full Mock 总数仍为 80，未降低阈值。

### 旧数据兼容

以下标识故意保留，仅用于解析和展示旧记录：

- `recruitment`
- `jd_match`
- `analyzeJD`
- `recruitment-career`

它们仍存在于部分类型联合、Conversation Storage 解析器、Ops/Chat/Evaluation/Source 历史标签和安全拒绝分支中。旧记录会显示为“历史场景/意图/工具/知识包（已下线）”，但新运行路径不能产生这些值。

不要为了追求零关键词命中而删除这些兼容定义，也不要简单全局替换英文 `job`；技术代码中的 job 可能表示任务而非招聘。

## 5. 关键文件

- 活动场景边界：`src/lib/agent/scenarios.ts`
- Router 与 Mock 主流程：`src/lib/agent/index.ts`
- Real 结构化输出过滤：`src/lib/agent/api.ts`
- Legacy 工具拒绝：`src/lib/tools/index.ts`
- 默认知识数据：
  - `src/data/knowledgePacks.ts`
  - `src/data/enterpriseKnowledgePacks.ts`
- 80 条评测：`src/data/evaluation.ts`
- V2.0.4 Runtime 回归：`src/lib/agent/__tests__/scenarioRetirement.test.ts`
- V2.0.4 E2E：`e2e/scenario-retirement.spec.ts`
- 发布说明：`docs/v2.0.4-release-notes.md`
- 架构边界：`docs/architecture.md`
- 版本来源：`src/lib/appVersion.ts`

## 6. 已完成的验证

V2.0.4 最终门禁结果：

- 单元测试：29 个文件，116/116 通过
- Playwright E2E：28/28 通过（原 24 + 新增 4）
- Full Mock Evaluation：80/80，passRate 100%
- `npm.cmd run typecheck`：通过
- `npm.cmd run build`：通过
- `git diff --check`：通过
- `npm.cmd run audit:prod`：0 high、0 critical；保留 2 个已知 moderate
- Playwright report、trace、截图和临时目录均已清理
- 本地自动化没有调用 Real API

审计中的 2 个 moderate 来自 Next.js 16.2.10 的传递 PostCSS。`npm audit fix --force` 会建议降级到 Next 9，绝对不要执行。

## 7. 当前卡在哪里

当前没有代码阻塞。功能、测试、commit 和 stable tag 都已经完成。

真正未完成的是发布链路，而且需要用户明确授权：

1. V2.0.4 尚未合并到本地 `master`。
2. 本地 `master` 和缓存的 `origin/master` 本身也不一致。
3. V1.12.2～V2.0.4 的哪些 commits/tags 已存在远端，需要在发布前重新 fetch/只读核对，不能依赖旧缓存或口头状态。
4. V2 尚未 push、尚未部署。
5. Real API 流式、多轮、重新生成和编辑重发需要部署后做受控线上冒烟；本地自动化不调用 Real API。

因此，新会话不能直接 `git push` 或部署。先让用户明确要求“发布/推送/部署”，再做远端和服务器安全复核。

## 8. 下一步建议计划

如果用户下一步明确要求统一推送和部署 V2：

1. 先确认 `HANDOFF.md` 是否需要纳入下一次提交；不要擅自把它和已经打标的 V2.0.4 混进原 tag。
2. 执行只读 Git 复核：status、branch、HEAD、所有 stable tags、本地 master、远端 master。
3. `git fetch` 后比较真实 `origin/master`；网络失败就停止，不在未知远端状态下合并。
4. 明确设计合并方案。当前 feature 分支包含从 V1.12.3 到 V2.0.4 的连续 8 个提交，通常应把整个分支合入 master，而不是挑单个 V2 commit，但必须得到用户授权。
5. 合并前完整重跑发布门禁：

```powershell
npm.cmd run test:run
npm.cmd run typecheck
npm.cmd run evaluation:mock
npm.cmd run build
npm.cmd run e2e
npm.cmd run audit:prod
git diff --check
```

6. 仅普通 push；不 force。稳定标签只推送远端缺失的标签，不覆盖远端已有标签。
7. 部署前重新检查服务器 PM2、磁盘、`.env.local` 是否存在、`.runtime-data/` 是否存在，以及指定变量是否 configured；只输出 true/false，不输出值。
8. 下载明确 tag 的源码包并在临时目录验证版本。不要依赖服务器旧 `.git` 的 `origin/master`。
9. 用排除规则同步源码，保留 `.git/`、`.env*`、`.runtime-data/` 和服务器独有配置；不得先清空项目目录。
10. 服务器执行 `npm ci`、单测、typecheck、Mock Evaluation、build；任一步失败都不要重启 PM2。
11. 全部通过后才重启 PM2，并做页面、API、Mock、Real、Ops、Feedback、Knowledge、Streaming 和消息操作验收。

## 9. 绝对不要再踩的坑

### Git 与发布

- 不要假设当前 feature 已在 master。当前 master 明确仍是 V1.12.2。
- 不要在未 fetch 的情况下信任缓存 `origin/master`。
- 不要 `git reset --hard`、`git clean`、`git checkout .` 或随意 stash。
- 不要 force push，不要删除、重建或覆盖已有 stable tag。
- 不要把 V2.0.4 tag 移到包含 `HANDOFF.md` 的新 commit；已发布的本地标签必须保持指向 `1699ad2...`。
- 不要未经用户明确授权 merge、push 或部署。

### 服务器

- 服务器曾用源码包覆盖工作树但保留旧 `.git`，导致 Git 元数据与工作树版本错位。不要依赖服务器缓存的 `origin/master`，也不要执行 `git reset --hard origin/master`。
- 旧服务器状态已做过完整备份：`/var/backups/enterprise-agent-hub/20260711T024737Z`。不要删除。
- 不得删除或覆盖服务器 `.env.local`、`.env*`、`.runtime-data/`。
- 不得打印环境变量值、Token、API Key、provider、model 或 baseUrl。
- 任一服务器测试、评测或 build 失败时，不重启 PM2，保留旧线上进程。

### 代码与数据

- 不要把 legacy 标识重新加入活动场景、活动工具、默认知识或 Evaluation。
- 也不要删除 legacy 类型和解析映射，否则旧 Conversation、Ops 和历史展示会损坏。
- 用户自定义文档可以包含招聘或面试内容，绝对不能按关键词删除或禁用。
- 不要修改 Knowledge Storage key、Conversation key、备份 schema、Client Storage schema/version 或旧 runId。
- 不要修改多轮上下文、NDJSON 流式协议和 V2.0.3 消息操作核心行为，除非新任务明确要求。
- 不要为了消除关键词命中而误删通用 Retriever 的招聘同义词；它们用于把直接问题降级为 general 后检索用户自定义文档。

### 测试与 Windows 工具

- Playwright 中 `assistant-details` 内部还嵌套了 Trace `<summary>`；使用宽泛的 `.locator("summary")` 会命中两个元素。V2.0.4 已改为精确点击“查看依据、工具与执行过程”，不要改回宽泛选择器。
- E2E runner 使用 3100 端口并负责清理 `.eah-e2e-app-*`、`test-results/` 和 `playwright-report/`；失败后仍要确认没有产物残留。
- Windows PowerShell 的 `ConvertFrom-Json` 解析 `package-lock.json` 曾失败；版本一致性检查请用 Node.js `JSON.parse`。
- 读取 UTF-8 源文件时显式使用 `Get-Content -Encoding utf8`，否则中文可能显示为乱码；不要因此误判文件编码并大面积重写。
- `next build` 后检查 `next-env.d.ts` 是否出现生成性改动；若出现且与版本无关，提交前恢复，不能误入 staging。
- `npm audit` 因已知 moderate 返回 exit code 1 不等于出现 high/critical；但数量或等级变化时必须停止并报告。
- `src/data/evaluation.ts` 中存在一条 V2.0.3 基线已有的重复问题文本，不影响 80 个唯一 case ID 和当前 80/80。不要在无关发布任务里顺手重写评测集。

## 10. 安全与工作区规则

- 不读取、不打印、不提交 `.env.local`。
- 不提交 `.runtime-data/`、`test-documents/`、Playwright 产物或浏览器导出的备份 JSON。
- 不输出真实运行数据、完整 Prompt、conversationContext、工具原始响应或第三方原始错误。
- 使用 `apply_patch` 做源码和文档编辑，避免大面积格式化或重新编码。
- 保留用户已有改动；发现未知脏文件先停下盘点，不要覆盖。

## 11. 本交接文档自身的处理

`HANDOFF.md` 是本次会话结束前新创建的交接文件，没有纳入 `v2.0.4-stable`。下个会话应先执行 `git status`，确认它是唯一新增文件，再由用户决定：

- 单独提交到后续文档 commit；或
- 仅作为本地交接文件保留；或
- 用户明确要求后再删除。

不得为了恢复 clean 工作区而擅自删除、reset 或 clean 它。
