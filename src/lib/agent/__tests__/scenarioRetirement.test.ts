import { describe, expect, it } from "vitest";
import { evaluationCases } from "@/data/evaluation";
import { documents, scenarios, tools } from "@/data/mock";
import { knowledgePacks } from "@/data/knowledgePacks";
import { routeUserQuestion, runAgentPipeline } from "@/lib/agent";
import { normalizeStructuredOutput, runAgentApiPipeline } from "@/lib/agent/api";
import { ACTIVE_AGENT_SCENARIOS, normalizeActiveAgentScenario } from "@/lib/agent/scenarios";
import { runToolDemo } from "@/lib/tools";
import type { AgentStructuredOutput, ImportedKnowledgeDocument } from "@/types";

const fallbackOutput: AgentStructuredOutput = {
  scenario: "enterprise",
  intent: "knowledge_qa",
  answer: "fallback",
  evidence: [],
  toolsUsed: [],
  sources: [],
  confidence: 0.8,
  riskLevel: "low",
  nextAction: "review",
};

describe("retired recruitment scenario runtime boundary", () => {
  it("keeps recruitment out of active scenario, tool, knowledge and evaluation registries", () => {
    expect(ACTIVE_AGENT_SCENARIOS).not.toContain("recruitment");
    expect(scenarios.map((item) => item.id)).not.toContain("jd-match-agent");
    expect(tools.map((item) => item.name)).not.toContain("analyzeJD");
    expect(knowledgePacks.map((item) => item.id)).not.toContain("recruitment-career");
    expect(documents.some((item) => item.packId === "recruitment-career")).toBe(false);
    expect(evaluationCases).toHaveLength(80);
    expect(evaluationCases.some((item) => item.expectedScenario === "recruitment" || item.expectedIntent === "jd_match" || item.expectedTools.includes("analyzeJD"))).toBe(false);
    expect(normalizeActiveAgentScenario("recruitment", "recruitment")).toBe("general");
  });

  it("routes direct recruitment questions through general knowledge without the retired tool", () => {
    const route = routeUserQuestion("请帮我分析简历和岗位是否匹配");
    expect(route).toMatchObject({ scenario: "general", intent: "knowledge_qa", needRag: true, toolsNeeded: [] });
    const result = runAgentPipeline("请帮我分析简历和岗位是否匹配", documents);
    expect(result.route.scenario).toBe("general");
    expect(result.route.intent).not.toBe("jd_match");
    expect(result.toolResults.some((item) => item.tool === "analyzeJD")).toBe(false);
    expect(runToolDemo("analyzeJD", { jdText: "legacy", resumeText: "legacy" })).toMatchObject({ status: "failed", tool: "analyzeJD" });
  });

  it("does not reactivate recruitment from legacy conversation context", async () => {
    const result = await runAgentApiPipeline(
      "公司报销需要什么材料？",
      "mock",
      [],
      { messages: [{ role: "user", content: "旧会话：帮我分析招聘岗位" }, { role: "assistant", content: "旧记录来自招聘场景" }] },
    );
    expect(result.route).toMatchObject({ scenario: "enterprise", intent: "knowledge_qa" });
    expect(result.toolResults.some((item) => item.tool === "analyzeJD")).toBe(false);
  });

  it("rejects retired scenario, intent and tool values from model structured output", () => {
    const normalized = normalizeStructuredOutput(
      { scenario: "recruitment", intent: "jd_match", toolsUsed: ["analyzeJD"], answer: "legacy" },
      fallbackOutput,
    );
    expect(normalized).toMatchObject({ scenario: "enterprise", intent: "knowledge_qa", toolsUsed: [] });
    const normalizedLegacyFallback = normalizeStructuredOutput({}, { ...fallbackOutput, scenario: "recruitment", intent: "jd_match", toolsUsed: ["analyzeJD"] });
    expect(normalizedLegacyFallback).toMatchObject({ scenario: "general", intent: "general_chat", toolsUsed: [] });
  });

  it("still retrieves an enabled user document about recruitment without deleting it", async () => {
    const userDocument: ImportedKnowledgeDocument = {
      id: "user-custom-interview-guide",
      title: "用户自定义面试材料清单",
      category: "用户知识",
      tags: ["面试", "材料"],
      content: "用户自定义面试材料包括项目说明、业务流程图和验证结果。",
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
      importedAt: "2026-07-13T00:00:00.000Z",
      source: "pasted text",
      owner: "用户导入",
      sourceType: "user_paste",
      isDefault: false,
      enabled: true,
    };
    const result = await runAgentApiPipeline("面试材料需要准备什么？", "mock", [userDocument]);
    expect(result.route).toMatchObject({ scenario: "general", intent: "knowledge_qa" });
    expect(result.ragAnswer?.sources.map((item) => item.documentId)).toContain(userDocument.id);
    expect(userDocument).toMatchObject({ enabled: true, content: "用户自定义面试材料包括项目说明、业务流程图和验证结果。" });
  });
});
