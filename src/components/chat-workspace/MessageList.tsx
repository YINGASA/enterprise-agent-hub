"use client";

import { AssistantMessage } from "@/components/chat-workspace/AssistantMessage";
import { EmptyConversation } from "@/components/chat-workspace/EmptyConversation";
import { useChatScroll } from "@/components/chat-workspace/useChatScroll";
import type { MessageFeedbackDraft, MessageResultMap, TransientChatTurn } from "@/components/chat-workspace/types";
import type { ChatAnswerFeedbackValue, ConversationMessage } from "@/types";

type MessageListProps = {
  conversationId: string;
  messages: ConversationMessage[];
  transientTurn: TransientChatTurn | null;
  resultsByMessageId: MessageResultMap;
  feedbackByMessageId: Record<string, MessageFeedbackDraft>;
  examples: string[];
  onSelectExample: (question: string) => void;
  onRetry: () => void;
  onToggleFeedback: (messageId: string, value: ChatAnswerFeedbackValue) => void;
  onFeedbackReasonChange: (messageId: string, value: string) => void;
  onSubmitFeedback: (messageId: string) => void;
};

const emptyFeedback: MessageFeedbackDraft = { values: [], reason: "", message: "" };

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
}

function UserMessage({ message }: { message: ConversationMessage }) {
  return (
    <article data-testid="conversation-message-user" data-message-id={message.id} className="flex min-w-0 justify-end">
      <div className="min-w-0 max-w-[78%] sm:max-w-[72%]">
        <div className="mb-1 text-right text-xs text-ink-500"><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div>
        <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-brand-600 px-4 py-3 text-sm leading-7 text-white shadow-sm">{message.content}</p>
      </div>
    </article>
  );
}

function PendingAssistant({ turn, onRetry }: { turn: TransientChatTurn; onRetry: () => void }) {
  if (turn.status === "failed") {
    return (
      <article data-testid="assistant-error" role="alert" className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-rose-200 bg-white p-4 shadow-sm">
          <p className="font-semibold text-rose-800">本次发送失败</p>
          <p className="mt-2 break-words text-sm leading-6 text-rose-700">{turn.error ?? "请求失败，请稍后重试。"}</p>
          <button type="button" data-testid="agent-retry" onClick={onRetry} className="mt-3 cursor-pointer rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">重试</button>
        </div>
      </article>
    );
  }
  return (
    <article data-testid="assistant-pending" aria-live="polite" className="flex justify-start">
      <div className="w-full max-w-xl rounded-2xl rounded-tl-md border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-ink-700">Agent 正在处理</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-500 sm:grid-cols-4">
          {["理解问题", "检索依据", "调用工具", "生成回答"].map((step, index) => <span key={step} className={"rounded-md px-2 py-2 text-center " + (index === 0 ? "bg-brand-50 font-semibold text-brand-700" : "bg-slate-50")}>{step}</span>)}
        </div>
      </div>
    </article>
  );
}

export function MessageList(props: MessageListProps) {
  const transientForConversation = props.transientTurn?.conversationId === props.conversationId ? props.transientTurn : null;
  const scroll = useChatScroll({ conversationId: props.conversationId, messageCount: props.messages.length, transientKey: transientForConversation?.requestId ?? "" });
  return (
    <div className="relative min-h-0 flex-1 bg-slate-50/70">
      <div ref={scroll.containerRef} onScroll={scroll.onScroll} data-testid="message-list" className="h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-5 sm:px-6">
        <div data-testid="conversation-messages" className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5">
          {!props.messages.length && !transientForConversation ? <EmptyConversation examples={props.examples} onSelectExample={props.onSelectExample} /> : null}
          {props.messages.map((message) => {
            if (message.role === "user") {
              return <UserMessage key={message.id} message={message} />;
            }
            return <AssistantMessage key={message.id} message={message} result={props.resultsByMessageId[message.id]} feedback={props.feedbackByMessageId[message.id] ?? emptyFeedback} onToggleFeedback={props.onToggleFeedback} onFeedbackReasonChange={props.onFeedbackReasonChange} onSubmitFeedback={props.onSubmitFeedback} />;
          })}
          {transientForConversation ? <><UserMessage message={{ id: transientForConversation.userMessageId, role: "user", content: transientForConversation.question, createdAt: transientForConversation.createdAt }} /><PendingAssistant turn={transientForConversation} onRetry={props.onRetry} /></> : null}
          <div aria-hidden="true" className="h-1 shrink-0" />
        </div>
      </div>
      {scroll.showJumpToLatest ? <button type="button" data-testid="jump-to-latest" onClick={() => scroll.scrollToLatest("smooth")} className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-ink-700 shadow-lg transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">回到最新消息</button> : null}
    </div>
  );
}
