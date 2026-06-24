import { PageHeader } from "@/components/PageHeader";
import { ToolCard } from "@/components/ToolCard";
import { tools } from "@/data/mock";

export default function ToolsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool Center"
        title="工具中心"
        description="展示 Agent 可调用的业务工具契约，包括工具说明、输入参数示例和输出结果示例。"
      />
      <div className="grid gap-5">
        {tools.map((tool) => (
          <ToolCard key={tool.name} tool={tool} />
        ))}
      </div>
    </div>
  );
}
