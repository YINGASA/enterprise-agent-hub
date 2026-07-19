import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageContent } from "@/components/chat-workspace/MessageContent";

describe("MessageContent", () => {
  it("renders common Markdown as semantic document content", () => {
    const html = renderToStaticMarkup(<MessageContent content={[
      "## 办理步骤",
      "请先执行 `npm run check`。",
      "",
      "- 准备材料",
      "- 提交审批",
      "",
      "1. 创建申请",
      "2. 等待审核",
      "",
      "> 不要提交真实密钥。",
      "",
      "```ts",
      "const ready = true;",
      "```",
      "",
      "| 字段 | 状态 |",
      "| --- | --- |",
      "| 订单 | 已完成 |",
    ].join("\n")} />);

    expect(html).toContain("<h3");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<blockquote");
    expect(html).toContain("<pre");
    expect(html).toContain("<table");
    expect(html).toContain("<code");
  });

  it("keeps untrusted markup as escaped text", () => {
    const html = renderToStaticMarkup(<MessageContent content={'<script>alert("x")</script>\n\n<img src=x onerror=alert(1)>'} />);

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("renders an unfinished code fence deterministically", () => {
    const content = "```json\n{\"ok\": true}";
    expect(renderToStaticMarkup(<MessageContent content={content} />)).toEqual(renderToStaticMarkup(<MessageContent content={content} />));
  });
});
