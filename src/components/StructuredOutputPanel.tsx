import { MockJsonPanel } from "@/components/MockJsonPanel";
import type { AgentStructuredOutput } from "@/types";

export function StructuredOutputPanel({ output }: { output: AgentStructuredOutput }) {
  return <MockJsonPanel title="结构化 AgentResponse" data={output} />;
}
