"use client";

import { useRef } from "react";
import { useModalFocus } from "@/components/chat-workspace/useModalFocus";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ open, title, description, confirmLabel, danger = false, onCancel, onConfirm }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: cancelRef, onClose: onCancel });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" data-testid="conversation-confirm-dialog">
      <button type="button" aria-label="关闭确认对话框" className="absolute inset-0 cursor-default bg-slate-950/40" onClick={onCancel} />
      <section ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="conversation-confirm-title" aria-describedby="conversation-confirm-description" className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h2 id="conversation-confirm-title" className="text-lg font-semibold text-ink-900">{title}</h2>
        <p id="conversation-confirm-description" className="mt-2 text-sm leading-6 text-ink-600">{description}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button ref={cancelRef} type="button" data-testid="conversation-confirm-cancel" onClick={onCancel} className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">取消</button>
          <button type="button" data-testid="conversation-confirm-submit" onClick={onConfirm} className={"cursor-pointer rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " + (danger ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500" : "bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500")}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
