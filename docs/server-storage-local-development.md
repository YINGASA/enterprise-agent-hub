# 服务端存储本地开发说明

## 1. 前置条件

- Node.js 20。
- npm 与当前锁文件一致。
- 一个与生产隔离的 PostgreSQL 测试数据库。
- 不需要 Node 22，不要运行依赖自动升级或 `npm audit fix`。

没有 PostgreSQL 时仍可运行 local 模式和大部分纯函数/Repository mock 测试，但不能把 Prisma validate 或 mock 测试声明为真实 PostgreSQL 集成测试。

## 2. 安全配置

从 `.env.example` 复制变量名到未提交的本地环境文件，填写你自己的测试值：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/enterprise_agent_hub
SERVER_STORAGE_ENABLED=true
STORAGE_SESSION_SECRET=replace_with_at_least_32_random_characters
```

规则：

- 只使用独立开发/测试数据库，不连接腾讯云生产数据库。
- `STORAGE_SESSION_SECRET` 至少 32 个字符，使用随机值。
- `.env.local` 不提交、不打印、不复制到日志或测试快照。
- 不在 URL 中使用仓库示例之外的真实密码文本。

## 3. 安装与 Prisma

```bash
npm install
npm run db:generate
npm run db:validate
```

首次建立本地开发库时：

```bash
npm run db:migrate:dev
```

验证已有 migration 或类生产测试库时：

```bash
npm run db:migrate:deploy
npm run db:status
```

禁止执行 `prisma migrate reset` 或任何清空共享数据库的命令。

## 4. 启动与状态检查

```bash
npm run dev
```

浏览器访问：

- `http://localhost:3000/chat`
- `http://localhost:3000/knowledge`
- `http://localhost:3000/api/storage/status`

状态 API 只应返回：

```json
{
  "configured": true,
  "healthy": true,
  "storageMode": "server",
  "databaseType": "postgresql"
}
```

它不应返回数据库地址、用户名、密码、Cookie 或 Secret。

## 5. 三种模式验证

### local

`SERVER_STORAGE_ENABLED=false` 或未启用时：

- Chat 和 Knowledge 沿用 V2.1.0 localStorage。
- 不要求数据库连接。
- 原 storage key 与 Legacy 迁移保持不变。

### server

启用且数据库健康时：

- 页面显示服务端存储状态。
- 创建会话、完整 turn、Summary Patch 和用户知识文档写入当前匿名工作区。
- 刷新后通过 REST API 重新读取。
- 另一个无 Cookie 的浏览器上下文不能读取该工作区。

### degraded

启用但数据库不可用或配置不完整时：

- 页面显示服务端暂不可用。
- 可展示浏览器中已有的本地兼容数据（如有）。
- 写操作明确失败并提示重试。
- 不会静默把写入当作 localStorage 成功。

## 6. 验证命令

```bash
npm run test:storage
npm run test:storage:postgres
npm run test:run
npm run typecheck
npm run build
npm run evaluation:mock
npm run e2e
git diff --check
```

`test:storage:postgres` 仅在同时设置 `RUN_POSTGRES_INTEGRATION=1` 和独立的 `TEST_DATABASE_URL` 时执行真实 PostgreSQL 用例；否则明确跳过。CI 使用一次性 PostgreSQL 16 service，运行 migration deploy/status 后验证工作区隔离、事务/CAS、知识级联和迁移幂等。不要输出连接信息。

## 7. 手工冒烟

1. 打开 `/chat`，创建会话并完成一轮回答。
2. 刷新，确认会话与消息仍在。
3. 建立足够多完整 turn，确认 Summary 存储后仍能增量推进。
4. 验证 Regenerate、Edit & Resend 和 Stop；CAS 冲突不应产生部分写入。
5. 在 `/knowledge` 导入受支持的文本，刷新后确认文档与 chunks 可读。
6. 从 `/chat` 提问，确认 RAG 可引用当前工作区的已启用服务端知识。
7. 使用无 Cookie 的新浏览器上下文，确认无法读取第一工作区数据。
8. 模拟数据库不可用，确认 degraded 写入不会显示为成功。

## 8. 常见问题

- `local` 而不是 `server`：检查功能开关是否启用；不要打印环境变量值。
- `degraded`：确认数据库、会话 Secret 与 migration 状态；只报告 configured/healthy 布尔状态。
- Prisma Client 类型缺失：运行 `npm run db:generate`。
- Schema 不一致：先运行 `npm run db:validate` 和 `npm run db:status`，不要 reset 数据库。
