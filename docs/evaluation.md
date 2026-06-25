# Evaluation Dashboard

The Agent Evaluation Dashboard validates whether the Agent pipeline behaves as expected across enterprise knowledge QA, ecommerce after-sales support, recruitment/JD matching, AI engineering knowledge, and fallback scenarios.

## V0.9 Dataset

The built-in dataset now contains 50 cases:

- 12 enterprise policy cases
- 12 ecommerce support cases
- 12 recruitment and career cases
- 8 AI engineering cases
- 6 fallback / out-of-scope cases

The UI supports three suite sizes:

- Quick: 15 cases
- Standard: 30 cases
- Full: 50 cases

Each case includes question, expectedScenario, expectedIntent, expectedTools, expectedNeedRag, expectedKeywords, category, difficulty, and packId.

## Metrics

- passRate: percentage of cases that pass all checks.
- scenarioAccuracy: whether Router selected the expected scenario.
- intentAccuracy: whether Router selected the expected intent.
- toolHitRate: whether actual tools include expected tools.
- ragUsageAccuracy: whether RAG usage matches expectation.
- citationRate: whether RAG-required cases include sources.
- keywordHitRate: whether answer/evidence/sources/tools contain expected keywords.
- averageRagScore: average score of retrieved RAG chunks.
- fallbackCaseCount: number of fallback / general chat cases.
- fallbackRate: cases that use mock fallback or real text fallback.
- packCoverage: case distribution by knowledge pack.

## Failure Buckets

- scenario_mismatch
- intent_mismatch
- tool_mismatch
- rag_usage_mismatch
- keyword_miss
- citation_miss
- pipeline_error

## V0.9 Mock Full Evaluation Result

- quick: 15/15, passRate 100%
- standard: 30/30, passRate 100%
- full: 50/50, passRate 100%
- full averageRagScore: 21

Real mode remains optional because it consumes API quota. It is useful for checking whether the real LLM can produce stable structured output.
