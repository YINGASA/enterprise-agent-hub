import { PageHeader } from "@/components/PageHeader";
import { ToolCard } from "@/components/ToolCard";
import { tools } from "@/data/mock";

export default function ToolsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool Center"
        title="工具中心"
        description="展示 Agent 可调用的本地 mock 业务工具。点击每张卡片的运行示例，可以执行对应 TypeScript 工具函数并查看格式化 JSON 结果。"
      />
      <div className="grid gap-5">
        {tools.map((tool) => (
          <ToolCard key={tool.name} tool={tool} />
        ))}
      </div>
    </div>
  );
}
