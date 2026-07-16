"use client";

import { useCallback, useMemo, useState } from "react";
import { ChatComposer } from "@/components/chat-workspace/ChatComposer";
import { ChatHeader } from "@/components/chat-workspace/ChatHeader";
import { ChatHistoryDialog } from "@/components/chat-workspace/ChatHistoryDialog";
import { ConfirmDialog } from "@/components/chat-workspace/ConfirmDialog";
import { ConversationSidebar } from "@/components/chat-workspace/ConversationSidebar";
import { MessageList } from "@/components/chat-workspace/MessageList";
import { useAgentWorkspace } from "@/components/agent-workspace/useAgentWorkspace";
import { StorageStatusPanel } from "@/components/StorageStatusPanel";

const recommendedQuestions = [
  "我出差回来想报销，应该准备哪些材料？",
  "订单10001可以退货吗？",
  "公司报销审批一般需要多久？",
  "RAG 检索质量应该怎么评测？",
];

type ConfirmationState =
  | { kind: "clear"; conversationId: string; title: string }
  | { kind: "delete"; conversationId: string; title: string }
  | null;

export function AgentWorkspace() {
  const workspace = useAgentWorkspace("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const closeConfirmation = useCallback(() => setConfirmation(null), []);

  const activeConversation = workspace.activeConversation;
  const activeConversationId = workspace.conversationId;
  const hasMessages = workspace.conversationMessages.length > 0;
  const activeResponseMode = workspace.conversationMessages.slice().reverse().find((message) => message.role === "assistant")?.responseMode;
  const title = activeConversation?.title ?? "新对话";

  const requestDelete = useCallback((conversationId: string) => {
    const conversation = workspace.conversations.find((item) => item.id === conversationId) ?? (workspace.activeConversation?.id === conversationId ? workspace.activeConversation : null);
    if (!conversation) return;
    if (!conversation.messages.length) {
      workspace.deleteConversation(conversationId);
      return;
    }
    setConfirmation({ kind: "delete", conversationId, title: conversation.title });
  }, [workspace]);

  const requestClear = useCallback(() => {
    if (!activeConversationId || !hasMessages) return;
    setConfirmation({ kind: "clear", conversationId: activeConversationId, title });
  }, [activeConversationId, hasMessages, title]);

  const submitConfirmation = useCallback(() => {
    if (!confirmation) return;
    if (confirmation.kind === "clear") workspace.clearConversation();
    else workspace.deleteConversation(confirmation.conversationId);
    setConfirmation(null);
  }, [confirmation, workspace]);

  const confirmationCopy = useMemo(() => {
    if (!confirmation) return { title: "", description: "", confirmLabel: "" };
    if (confirmation.kind === "clear") return { title: "清空当前会话？", description: `“${confirmation.title}”的全部消息将被删除，会话本身会保留并重置为新对话。其他会话不受影响。`, confirmLabel: "确认清空" };
    return { title: "删除这个会话？", description: `“${confirmation.title}”及其本地消息将被删除，其他会话和反馈记录不受影响。`, confirmLabel: "确认删除" };
  }, [confirmation]);

  return (
    <div data-testid="chat-workspace" className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
      <ConversationSidebar
        conversations={workspace.conversations}
        activeConversationId={activeConversationId}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={closeMobileSidebar}
        onNewConversation={workspace.newConversation}
        onSelectConversation={workspace.switchConversation}
        onRenameConversation={workspace.renameConversation}
        onRequestDelete={requestDelete}
        onRequestClearCurrent={requestClear}
        onOpenHistory={openHistory}
        activeHasMessages={hasMessages}
        storageStatus={workspace.storageStatus}
      />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ChatHeader
          title={title}
          mode={workspace.mode}
          responseMode={activeResponseMode}
          hasMessages={hasMessages}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenSidebar={openMobileSidebar}
          onOpenHistory={openHistory}
          onRequestClear={requestClear}
          onRequestDelete={() => requestDelete(activeConversationId)}
        />
        <StorageStatusPanel status={workspace.storageStatus} onRetry={workspace.refreshStorage} onMigrationComplete={workspace.refreshStorage} />
        <MessageList
          conversationId={activeConversationId}
          messages={workspace.conversationMessages}
          transientTurn={workspace.transientTurn}
          resultsByMessageId={workspace.resultsByMessageId}
          feedbackByMessageId={workspace.feedbackByMessageId}
          examples={recommendedQuestions}
          onSelectExample={workspace.setQuestion}
          onRetry={workspace.retryLastTurn}
          onRegenerate={workspace.regenerateLastAnswer}
          onEditResend={workspace.editAndResendLastQuestion}
          onToggleFeedback={workspace.toggleFeedback}
          onFeedbackReasonChange={workspace.setFeedbackReason}
          onSubmitFeedback={(messageId) => void workspace.saveFeedback(messageId)}
        />
        <ChatComposer
          value={workspace.question}
          mode={workspace.mode}
          isLoading={workspace.isLoading}
          isCheckingHealth={workspace.isCheckingHealth}
          realApiUnavailable={workspace.realApiUnavailable}
          storageWritable={workspace.storageStatus !== null && workspace.storageStatus.storageMode !== "degraded"}
          llmStatus={workspace.llmStatus}
          llmStatusError={workspace.llmStatusError}
          healthResult={workspace.healthResult}
          onChange={workspace.setQuestion}
          onModeChange={workspace.setMode}
          onSend={() => void workspace.runAgent()}
          onStop={workspace.stopGeneration}
          onCheckHealth={() => void workspace.checkHealth()}
        />
      </section>
      <ConfirmDialog open={Boolean(confirmation)} title={confirmationCopy.title} description={confirmationCopy.description} confirmLabel={confirmationCopy.confirmLabel} danger onCancel={closeConfirmation} onConfirm={submitConfirmation} />
      <ChatHistoryDialog open={historyOpen} currentResult={workspace.result} onClose={closeHistory} />
    </div>
  );
}
