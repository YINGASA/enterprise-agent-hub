# Evaluation Dashboard

The Agent Evaluation Dashboard validates whether the Agent pipeline behaves as expected across enterprise knowledge QA, ecommerce after-sales support, and recruitment/JD matching scenarios.

## Evaluation Dataset

The built-in dataset contains 15 cases:

- 5 enterprise knowledge base cases
- 5 ecommerce customer support and after-sales cases
- 5 recruitment and JD matching cases

Each case includes:

- question
- expectedScenario
- expectedIntent
- expectedTools
- expectedNeedRag
- expectedKeywords
- category
- difficulty

## Metrics

- `passRate`: percentage of cases that pass all checks.
- `scenarioAccuracy`: whether Router selected the expected scenario.
- `intentAccuracy`: whether Router selected the expected intent.
- `toolHitRate`: whether actual tools include expected tools.
- `ragUsageAccuracy`: whether RAG usage matches expectation.
- `citationRate`: whether RAG-required cases include sources.
- `keywordHitRate`: whether answer/evidence/sources/tools contain expected keywords.
- `realSuccessRate`: Real API cases that return `real` or `real_repaired`.
- `jsonParseSuccessRate`: cases with valid structured output.
- `fallbackRate`: cases that fall back to mock or text fallback.
- `averageDurationMs`: average case execution time.

## Failure Buckets

V0.6.1 adds failure bucket analysis:

- `scenario_mismatch`
- `intent_mismatch`
- `tool_mismatch`
- `rag_usage_mismatch`
- `keyword_miss`
- `citation_miss`
- `pipeline_error`

Each failed case includes `failureReasons` and `failureSummary`, so the issue can be traced back to Router, RAG, Tool, keyword coverage, citation, or pipeline execution.

## V0.6.1 Mock Evaluation Result

- total: 15
- passed: 15
- passRate: 100%
- scenarioAccuracy: 100%
- intentAccuracy: 100%
- toolHitRate: 100%
- ragUsageAccuracy: 100%
- citationRate: 100%
- keywordHitRate: 100%

## Real Mode

Real mode is optional because it consumes API quota. It is useful for checking whether the real LLM can produce stable structured output. If real JSON fails, the system attempts repair and then falls back gracefully.