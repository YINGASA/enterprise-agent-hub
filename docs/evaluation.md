# Evaluation Dashboard

The Agent Evaluation Dashboard validates whether the Agent pipeline behaves as expected across enterprise knowledge QA, ecommerce after-sales support, recruitment/JD matching, AI engineering knowledge, and fallback scenarios.

## V0.9 Dataset

The built-in dataset now contains 58 cases after V1.1 demo scenario expansion:

- 12 enterprise policy cases
- 12 ecommerce support cases
- 12 recruitment and career cases
- 8 AI engineering cases
- 6 fallback / out-of-scope cases

The UI supports three suite sizes:

- Quick: 15 cases
- Standard: 30 cases
- Full: all current cases

Each case includes question, expectedScenario, expectedIntent, expectedTools, expectedNeedRag, expectedKeywords, category, difficulty, and packId. V1.1 adds cases for IT/admin operations, ecommerce edge policies, recruitment matching, and AI engineering explainability.

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

## V1.1 Mock Full Evaluation Result

- quick: 15/15, passRate 100%
- standard: 30/30, passRate 100%
- full: validated locally in Mock mode during V1.1 acceptance; target passRate >= 90%
- full averageRagScore: 21

Real mode remains optional because it consumes API quota. It is useful for checking whether the real LLM can produce stable structured output.

## V1.0 Compatibility Note

The evaluation API remains deterministic and server-side. It does not read browser `localStorage`, so user-imported knowledge documents do not change the built-in evaluation suite. V1.0 manual testing covers local import and chat retrieval separately, while `/api/evaluation` continues to validate the default Agent Router, keyword RAG, tools, fallback, and LLM response modes against the 50-case dataset.

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
