# Evaluation Dashboard

The Agent Evaluation Dashboard validates whether the Agent pipeline behaves as expected across enterprise knowledge and policy QA, ecommerce after-sales workflows, AI engineering knowledge, tool orchestration, clarification, context, and fallback scenarios.

## V2.0.4 Dataset

The built-in dataset contains 80 active enterprise-product cases:

- enterprise policy, reimbursement, travel, approval, and internal-process cases
- ecommerce order, return, refund, logistics, and service cases
- AI engineering, RAG explainability, and retrieval-quality cases
- clarification, multi-turn context, tool orchestration, and fallback cases

The UI supports three suite sizes:

- Quick: 15 cases
- Standard: 30 cases
- Full: 80 current cases

Each case includes question, expectedScenario, expectedIntent, expectedTools, expectedNeedRag, expectedKeywords, category, difficulty, and packId. V2.0.4 replaced 16 retired product-scenario cases without reducing the 80-case total or the required pass rate. The current suite covers IT/admin operations, reimbursement and approval materials, ecommerce edge policies, AI engineering explainability, Hybrid RAG quality, tools, clarification, context, and fallback behavior.

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

## V1.3 Mock Full Evaluation Result

- quick: 15/15, passRate 100%
- standard: 30/30, passRate 100%
- full: 80/80, passRate 100%
- full target: passRate >= 90%

Real mode remains optional because it consumes API quota. It is useful for checking whether the real LLM can produce stable structured output.

## V1.0 Compatibility Note

The evaluation API remains deterministic and server-side. It does not read browser `localStorage`, so user-imported knowledge documents do not change the built-in evaluation suite. V1.0 manual testing covers local import and chat retrieval separately, while `/api/evaluation` continues to validate the default Agent Router, keyword RAG, tools, fallback, and LLM response modes against the 80-case dataset.

## V1.1 Source Explainability Checks

V1.1 keeps evaluation deterministic and server-side. The API does not read browser localStorage, so user-uploaded and pasted documents are validated manually in /knowledge and /chat. Evaluation cases focus on Router, RAG, tools, fallback, and keyword coverage. Manual checks verify that Top sources display sourceType and scoreReason for default, user_upload, and user_paste sources.

Manual V1.1 checks:

- Confirm default knowledge categories are read-only and have no one-click demo import controls.
- Import user documents by paste and file upload, then verify localStorage persistence.
- Confirm Top sources show source type, category, tags, score, scoreReason, and chunk summary.
- Confirm Mock full evaluation remains above 90% passRate.

## V1.2 Retrieval Quality Cases

V1.2 adds retrieval-quality cases for synonym expansion, business phrase matching, colloquial user questions, AI engineering questions, and low-confidence fallback. Example checks include:

- invoice-loss reimbursement questions should hit reimbursement policy.
- expired 7-day return questions should hit after-sales policy and request missing order context.
- colloquial refund questions should trigger ecommerce policy_check without using demo order data.
- invalid JSON questions should hit JSON repair / fallback knowledge.
- weather questions should remain general fallback and should not force unrelated RAG citations.

The full suite target remains passRate >= 90%. Failure buckets continue to explain scenario, intent, tool, RAG usage, citation, keyword, and pipeline issues.

V1.2.1 adds focused AI engineering routing checks. Invalid JSON output, inaccurate RAG retrieval, failed Agent tool calls, and Agent evaluation dataset questions should resolve to `ai_engineering / knowledge_qa`, use RAG, and prioritize AI engineering sources. This guards against technical knowledge questions falling back to the generic scenario even when retrieval succeeds.


## V1.3 History and Reports

V1.3 adds browser-local evaluation history. Users can save a run, review the latest 20 records, compare the latest passRate with the previous run, inspect the recent five-run average, delete one record, clear all records, and export reports as Markdown or JSON.

The history is stored in localStorage and is not sent to a database. `/api/evaluation` remains deterministic and stateless; the browser decides whether to save or export the returned result.

## V1.4 Trend Visualization and Report Preview

V1.4 keeps the evaluation API stateless and adds frontend-only observability features:

- Trend charts for the latest 20 saved runs, including passRate, fallbackRate, and averageRagScore.
- Enhanced trend summary with latest pass rate, delta from previous run, recent five-run average, latest fallback rate, latest average RAG score, and latest run time.
- Markdown and JSON report preview before download.
- Copy-to-clipboard support for generated report content.
- Expandable history detail panels for metrics, failure summary, and failure buckets.

All of these features read from browser localStorage. They do not introduce a database, backend persistence, or external analytics service.
## V1.5 Retriever Strategy Cases

V1.5 extended the full suite to 80 cases. The current equivalents cover short technical queries, colloquial refund intent, reimbursement ticket loss, enterprise workflow clarification, weather fallback, and embedding/vector-database concepts.

The target remains passRate >= 90%. These cases validate that the Retriever Adapter does not regress Router decisions, missing-parameter clarification, low-confidence fallback, or AI engineering knowledge routing.
## V1.6.1 Knowledge Import Persistence Check

V1.6.1 does not change the built-in evaluation API. `/api/evaluation` still runs against the default mock knowledge base so full Mock remains stable at 80/80 in local validation.

User-imported documents are validated manually because they live in browser localStorage. Recommended checks:

- Import a `.md` or pasted policy document in `/knowledge`.
- Refresh the page and confirm the user document count, document details, and chunks remain visible.
- Ask a related question in `/chat` and confirm sources include `user_upload` or `user_paste`.
- Delete or clear user documents and confirm default Knowledge Packs remain available.
