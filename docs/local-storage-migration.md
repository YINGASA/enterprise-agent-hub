# localStorage 平滑迁移说明

## 1. 目标

V2.2.0 允许用户明确确认后，将现有 V2.0.4 / V2.1.0 浏览器数据导入当前匿名服务端工作区。迁移是可预检、幂等、可解释且保留回滚备份的；它不会要求清空浏览器数据，也不会自动覆盖服务端记录。

## 2. 可迁移内容

- Conversation 标题、ID、createdAt、updatedAt 与 revision。
- 已完成的 user / assistant Message、稳定顺序、runId、responseMode 和安全 assistant details。
- 合法 Conversation Summary，包括 text、throughMessageId、updatedAt、version: 1 和 sourceMessageCount。
- 用户 KnowledgeDocument 及可重建 chunks 所需信息。

pending、streaming partial、aborted、失败回答、损坏的 Summary 和不符合现有 sanitizer 的记录不会被导入。

## 3. 流程

```text
发现本地数据
→ 用户明确允许上传本地会话与知识正文用于迁移预检
→ 生成最小迁移包与确定性 migrationId
→ POST /api/storage/migration/preview
→ 展示 imported / skipped / conflicted / failed
→ 用户第二次确认执行导入
→ POST /api/storage/migration
→ 服务端事务导入当前 Cookie 工作区
→ 校验并返回最终计数
→ 浏览器写入迁移状态标记
→ 保留原 localStorage 数据
```

第一次确认发生在迁移正文发送前；用户拒绝时，客户端不调用预检或执行 API。预检会向服务端发送经限制与净化的迁移包，但不写入数据库；只有用户在看到预检计数后再次确认，才会执行事务导入。

客户端不会在请求中携带 workspaceId。服务端依据签名 HttpOnly Cookie 解析工作区。

## 4. 幂等与冲突

`migrationId` 由已净化的本地数据确定性生成，不包含可读正文。服务端以 `(workspaceId, migrationId)` 唯一记录执行结果：

- 相同 migrationId 重复执行：返回既有结果并标记幂等，不重复创建数据。
- ID 不存在且容量允许：imported。
- ID 已存在且内容一致：skipped。
- ID 已存在但内容不同：conflicted，服务器记录优先。
- 记录损坏或超过容量：failed。

冲突不会静默覆盖服务器或删除本地数据。用户可以继续使用服务器版本，并保留 localStorage 作为人工对照/回滚来源。

## 5. 原数据与状态标记

迁移成功后：

- Conversation 和 Knowledge 的原 localStorage key 不改变。
- 原数据不删除、不重写。
- 只增加 `enterprise-agent-hub:server-storage-migration:v1` 状态标记，记录 migrationId、完成时间和聚合计数。
- 如果本地数据发生变化，会生成新的迁移标识并允许重新预检。

标记只用于浏览器提示，不作为服务端授权或数据真实性依据。

## 6. 容量与验证

- Conversation 最多 10 个。
- 每个 Conversation 最多 100 条已完成消息。
- KnowledgeDocument 使用现有用户文档数量和正文大小上限。
- 重复 Conversation/Message/Document ID 会按无效或冲突处理。
- Summary cursor 必须能由当前 Conversation 历史验证；损坏 Summary 只被丢弃，不破坏 messages。

迁移 API 对 Payload、字符串长度、数组容量、同源请求和数据类型执行严格校验。错误响应不包含数据库堆栈、消息正文或知识正文。

## 7. 回退与故障

- 预检不写入数据库。
- 用户未允许上传时不发送迁移包；预检后取消时不执行导入。
- 数据库不可用时进入 degraded，迁移不会伪装成功。
- 服务端事务失败时不会留下本次部分导入。
- 已存在的服务器记录不会因本次失败受损。
- 浏览器原数据保留，因此可以等待服务恢复后重试。

## 8. 验收清单

- 空 localStorage 不显示无意义迁移。
- 只有 Conversation、Conversation + Summary、只有知识文档均可预检。
- 重复提交不增加记录数。
- ID 冲突得到 conflicted 计数，服务器数据保持不变。
- 导入后刷新可读取会话、消息、摘要、知识文档和 chunks。
- 新的无 Cookie 浏览器上下文看不到当前工作区迁移数据。
- 迁移后原 localStorage 内容仍存在。
