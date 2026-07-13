"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD = 96;

export function useChatScroll(params: { conversationId: string; messageCount: number; transientKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const previousConversationId = useRef("");
  const previousMessageCount = useRef(0);
  const previousTransientKey = useRef("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const updateNearBottom = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    const nearBottom = distance <= BOTTOM_THRESHOLD;
    nearBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom && element.scrollHeight > element.clientHeight);
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const element = containerRef.current;
    if (!element) return;
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || behavior === "auto") element.scrollTop = element.scrollHeight;
    else element.scrollTo({ top: element.scrollHeight, behavior });
    nearBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  useEffect(() => {
    const conversationChanged = previousConversationId.current !== params.conversationId;
    const transientStarted = Boolean(params.transientKey) && previousTransientKey.current !== params.transientKey;
    const messagesChanged = previousMessageCount.current !== params.messageCount;
    const shouldFollow = conversationChanged || transientStarted || (messagesChanged && nearBottomRef.current);
    previousConversationId.current = params.conversationId;
    previousMessageCount.current = params.messageCount;
    previousTransientKey.current = params.transientKey;
    if (!shouldFollow) return;
    const frame = requestAnimationFrame(() => scrollToLatest("auto"));
    return () => cancelAnimationFrame(frame);
  }, [params.conversationId, params.messageCount, params.transientKey, scrollToLatest]);

  return { containerRef, showJumpToLatest, onScroll: updateNearBottom, scrollToLatest };
}
