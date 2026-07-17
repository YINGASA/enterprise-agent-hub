# 服务端存储部署前置说明

## 当前状态

V2.2.0 的 Git 发布不包含腾讯云应用部署、服务器 Release、Canary、PM2 切换或生产数据库 migration。腾讯云线上应用仍保持 V2.0.4。

以下内容是未来获得单独部署授权后必须完成的前置条件，不表示已经执行。

## 1. 基础设施隔离

- 准备 PostgreSQL 数据库和最小权限应用账号。
- 开发、测试、Canary 与生产数据库必须隔离。
- 若使用腾讯云数据库测试基础设施，不得连接或覆盖线上 V2.0.4 应用数据。
- 确认数据库备份、保留策略、恢复演练和可观测性。
- 不在本版本接入 COS、对象存储或 pgvector。

## 2. Secret 与网络

服务器需要配置以下变量，但任何检查只输出 configured=true/false，不输出值：

- `DATABASE_URL`
- `SERVER_STORAGE_ENABLED`
- `STORAGE_SESSION_SECRET`

同时保留现有模型服务变量。要求：

- STORAGE_SESSION_SECRET 使用高熵随机值且至少 32 字符。
- DATABASE_URL 使用 TLS 与最小权限账户（按数据库供应商能力配置）。
- Secret 仅保存在服务器安全配置中，不写入 Git、Release 包、日志或截图。
- 数据库网络只允许必要来源访问。

## 3. 发布前备份

- 备份当前 V2.0.4 应用目录、`.env.local` 和 `.runtime-data/`，但不得在报告中输出内容。
- 记录当前 PM2 process、监听端口、健康状态和 Release 指向。
- 对 PostgreSQL 做部署前一致性备份，并验证可以恢复。
- 不删除历史 Release、旧 Stable Tag 或 localStorage 数据。

## 4. Migration 门禁

在独立测试数据库先执行：

```bash
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
npm run db:status
npm run test:storage
npm run test:storage:postgres
npm run test:run
npm run typecheck
npm run build
npm run evaluation:mock
```

真实 PostgreSQL 门禁必须使用隔离测试数据库；设置 `RUN_POSTGRES_INTEGRATION=1` 与 `TEST_DATABASE_URL` 后执行 `test:storage:postgres`。生产部署仅执行 `db:migrate:deploy`，禁止 `migrate reset`。对 migration SQL 做人工审查，确认：

- 外键和复合工作区约束正确。
- revision 默认值和唯一索引正确。
- 删除级联仅影响同工作区关联记录。
- 不包含删除或重写未知生产表的语句。

## 5. Canary 顺序

获得部署授权后建议：

1. 保持现有 PM2 V2.0.4 进程在线。
2. 在独立 Release 目录安装依赖、生成 Prisma Client、验证 migration 和 build。
3. 先以 `SERVER_STORAGE_ENABLED=false` 启动 Canary，确认 V2.1 local 兼容路径。
4. 在隔离测试工作区启用 server 模式，验证 Cookie、CRUD、CAS、Summary、知识与 RAG。
5. 模拟数据库故障，确认 degraded 不伪装写入成功。
6. 验证 Ops 无口令/错误口令仍返回 401，状态数据不泄露 Secret 或正文。
7. 全部通过后才评估流量切换；任何失败都保留 V2.0.4 进程并停止切换。

## 6. 线上验收

- `/api/storage/status` 只返回安全四字段。
- 两个匿名浏览器工作区严格隔离。
- 创建会话、刷新、Summary、Regenerate、Edit & Resend、Stop 与 CAS 正常。
- pending、partial、aborted 回答不入库。
- 知识文档刷新后存在，chunks 与 checksum 一致，RAG 可检索当前工作区知识。
- localStorage 迁移预检、确认、幂等、冲突和原数据保留正确。
- 数据库不可用时 degraded 写入明确失败。
- 模型 Context Plan、Streaming 与 Full Mock 行为没有回归。

## 7. 回滚

- 应用回滚：切回保留的 V2.0.4 Release/PM2 进程，不删除 PostgreSQL 数据。
- 数据回滚：仅在明确的数据恢复方案下使用部署前备份；不使用 Prisma reset。
- 浏览器回滚：原 localStorage 未被删除，V2.0.4 可继续读取既有 messages；未知 Summary/迁移标记可被旧版本忽略。
- 回滚后保留失败 Release、日志和聚合诊断用于复盘，但不得记录用户正文或 Secret。
