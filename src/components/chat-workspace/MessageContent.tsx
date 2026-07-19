import { Fragment, memo, type ReactNode } from "react";

type MessageContentProps = {
  content: string;
  className?: string;
};

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code"; language: string; value: string }
  | { type: "table"; headers: string[]; rows: string[][] };

const headingPattern = /^(#{1,6})\s+(.+)$/;
const unorderedPattern = /^\s*[-*+]\s+(.+)$/;
const orderedPattern = /^\s*\d+[.)]\s+(.+)$/;
const quotePattern = /^\s*>\s?(.*)$/;
const fencePattern = /^\s*```([^`]*)$/;

function splitTableRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function startsBlock(lines: string[], index: number) {
  const line = lines[index] ?? "";
  if (!line.trim()) return true;
  if (fencePattern.test(line) || headingPattern.test(line) || unorderedPattern.test(line) || orderedPattern.test(line) || quotePattern.test(line)) return true;
  return line.includes("|") && isTableDivider(lines[index + 1] ?? "");
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(fencePattern);
    if (fence) {
      const language = fence[1]?.trim().replace(/[^a-zA-Z0-9_+-]/g, "").slice(0, 24) ?? "";
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index] ?? "")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language, value: code.join("\n") });
      continue;
    }

    const heading = line.match(headingPattern);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]!.trim() });
      index += 1;
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|") && (lines[index] ?? "").trim()) {
        const cells = splitTableRow(lines[index] ?? "");
        rows.push(headers.map((_, cellIndex) => cells[cellIndex] ?? ""));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const quote = line.match(quotePattern);
    if (quote) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const match = (lines[index] ?? "").match(quotePattern);
        if (!match) break;
        quoteLines.push(match[1] ?? "");
        index += 1;
      }
      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    const unordered = line.match(unorderedPattern);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = (lines[index] ?? "").match(unorderedPattern);
        if (!match) break;
        items.push(match[1]!.trim());
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    const ordered = line.match(orderedPattern);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = (lines[index] ?? "").match(orderedPattern);
        if (!match) break;
        items.push(match[1]!.trim());
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && !startsBlock(lines, index)) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }
    if (!paragraph.length) {
      paragraph.push(line.trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(`[^`\n]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-ink-800 ring-1 ring-slate-200">{part.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export const MessageContent = memo(function MessageContent({ content, className = "" }: MessageContentProps) {
  const blocks = parseMarkdown(content);

  return (
    <div className={`min-w-0 space-y-4 text-[15px] leading-7 text-ink-800 ${className}`.trim()}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          const headingClass = block.level <= 2 ? "text-lg font-semibold text-ink-950" : "text-base font-semibold text-ink-900";
          return block.level <= 2
            ? <h3 key={key} className={`max-w-[76ch] text-wrap-pretty ${headingClass}`}>{renderInline(block.text)}</h3>
            : <h4 key={key} className={`max-w-[76ch] text-wrap-pretty ${headingClass}`}>{renderInline(block.text)}</h4>;
        }
        if (block.type === "paragraph") {
          return <p key={key} className="max-w-[76ch] whitespace-pre-wrap break-words text-wrap-pretty">{renderInline(block.lines.join("\n"))}</p>;
        }
        if (block.type === "quote") {
          return <blockquote key={key} className="max-w-[76ch] border-l-2 border-brand-300 bg-brand-50/60 px-4 py-2 text-ink-700">{block.lines.map((line, lineIndex) => <p key={lineIndex} className="whitespace-pre-wrap break-words">{renderInline(line)}</p>)}</blockquote>;
        }
        if (block.type === "unordered-list" || block.type === "ordered-list") {
          const List = block.type === "ordered-list" ? "ol" : "ul";
          return <List key={key} className={`max-w-[76ch] space-y-1.5 pl-6 ${block.type === "ordered-list" ? "list-decimal" : "list-disc"}`}>{block.items.map((item, itemIndex) => <li key={itemIndex} className="break-words pl-1 marker:text-ink-400">{renderInline(item)}</li>)}</List>;
        }
        if (block.type === "code") {
          return (
            <figure key={key} className="min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
              <figcaption className="flex min-h-9 items-center border-b border-slate-800 px-3 font-mono text-xs text-slate-400">{block.language || "代码"}</figcaption>
              <pre tabIndex={0} aria-label={`${block.language || "代码"}代码块，可横向滚动`} className="max-h-[32rem] overflow-auto p-4 text-sm leading-6 text-slate-100"><code>{block.value}</code></pre>
            </figure>
          );
        }
        return (
          <div key={key} tabIndex={0} aria-label="回答表格，可横向滚动" className="max-w-full overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-ink-600">
                <tr>{block.headers.map((header, cellIndex) => <th key={cellIndex} scope="col" className="whitespace-nowrap px-3 py-2.5">{renderInline(header)}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="min-w-32 px-3 py-2.5 align-top text-ink-700">{renderInline(cell)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
});
