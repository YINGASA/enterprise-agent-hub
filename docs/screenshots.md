# Screenshots Guide

This file lists the screenshots to capture before publishing the project on GitHub, Vercel, or a resume portfolio page.

No real screenshots are committed in V0.8. When screenshots are ready, place them under `public/screenshots/` and then update README links.

## 1. Home Page

- Route: `/`
- Suggested file: `public/screenshots/home-overview.png`
- Capture goal: show the project positioning, core capabilities, and first business scenarios.
- Interview value: lets reviewers understand the product scope within a few seconds.

## 2. Chat Agent Pipeline

- Route: `/chat`
- Suggested file: `public/screenshots/chat-agent-pipeline.png`
- Capture goal: show the Agent workspace with Router, RAG, Tools, LLM step, structured JSON output, and Real API mode result.
- Suggested question: `订单10001能不能退？`
- Interview value: demonstrates that this is not just a chat UI, but a multi-step Agent pipeline.

## 3. Knowledge Base

- Route: `/knowledge`
- Suggested file: `public/screenshots/knowledge-base-chunks.png`
- Capture goal: show knowledge documents, selected document chunks, extracted keywords, and source citation examples.
- Interview value: explains the current mock RAG chain and the upgrade path to vector retrieval.

## 4. Tool Center

- Route: `/tools`
- Suggested file: `public/screenshots/tool-center-run-result.png`
- Capture goal: show tool cards, runnable examples, execution status, and formatted JSON output.
- Interview value: highlights local business Tool Calling and the boundary prepared for model-native tool calls.

## 5. Evaluation Dashboard

- Route: `/evaluation`
- Suggested file: `public/screenshots/evaluation-dashboard-15-of-15.png`
- Capture goal: show 15/15 mock evaluation results, metric cards, result table, and failure analysis area.
- Interview value: shows evaluation and observability thinking instead of relying on one-off demo answers.

## 6. About Page

- Route: `/about`
- Suggested file: `public/screenshots/about-project-showcase.png`
- Capture goal: show architecture, version capabilities, evaluation result, and resume highlights.
- Interview value: serves as a concise project walkthrough page during interviews.

## Capture Notes

- Do not include real API keys, full proxy URLs, or private data in screenshots.
- Prefer browser width around 1440px for desktop screenshots.
- If capturing Real API mode, confirm the UI only displays masked key diagnostics.
- Keep Mock mode screenshots available so the project can be demonstrated without API credentials.
