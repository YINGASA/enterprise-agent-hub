"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/chat-workspace/ConfirmDialog";
import type { KnowledgeImportWorkspaceController } from "@/components/knowledge-workspace/useKnowledgeImportWorkspace";
import type { WorkspaceKnowledgePack } from "@/types";

type Props = { workspace: KnowledgeImportWorkspaceController };

const packStatusLabel = {
  active: "启用",
  archived: "已归档",
} as const;

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" });
}

export function WorkspaceKnowledgePackPanel({ workspace }: Props) {
  const { storageStatus, packs, busy, createPack, updatePack, removePack } = workspace;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [localError, setLocalError] = useState("");
  const [removingPack, setRemovingPack] = useState<WorkspaceKnowledgePack | null>(null);
  const [removingPackId, setRemovingPackId] = useState("");
  const removeInFlight = useRef(false);

  if (!storageStatus) {
    return (
      <section data-testid="knowledge-pack-panel" data-status="loading" aria-busy="true" className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-ink-900">企业知识包</h3>
        <p role="status" className="mt-2 text-sm leading-6 text-ink-500">正在读取工作区和知识包状态…</p>
      </section>
    );
  }

  if (storageStatus.storageMode !== "server") {
    const degraded = storageStatus?.storageMode === "degraded";
    return (
      <section data-testid="knowledge-pack-panel" data-status={storageStatus.storageMode} className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-ink-900">企业知识包</h3>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          {degraded ? "服务端暂不可用，企业知识包当前只读，恢复连接后可继续管理。" : "企业知识包需要服务端存储；本地模式仍可使用现有单文档知识导入。"}
        </p>
      </section>
    );
  }

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");
    if (!name.trim()) { setLocalError("请填写知识包名称。"); return; }
    try {
      await createPack(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "知识包创建失败。");
    }
  }

  function startEditing(pack: WorkspaceKnowledgePack) {
    setEditingId(pack.id);
    setEditingName(pack.name);
    setEditingDescription(pack.description ?? "");
    setLocalError("");
  }

  async function saveEditing(pack: WorkspaceKnowledgePack) {
    if (!editingName.trim()) { setLocalError("知识包名称不能为空。"); return; }
    try {
      await updatePack(pack, { name: editingName.trim(), description: editingDescription.trim() || null });
      setEditingId("");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "知识包更新失败。");
    }
  }

  async function removeSelectedPack() {
    if (!removingPack || removeInFlight.current) return;
    const selectedPack = removingPack;
    removeInFlight.current = true;
    setRemovingPack(null);
    setRemovingPackId(selectedPack.id);
    setLocalError("");
    try {
      await removePack(selectedPack);
      if (editingId === selectedPack.id) setEditingId("");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "知识包删除失败。");
    } finally {
      removeInFlight.current = false;
      setRemovingPackId("");
    }
  }

  return (
    <section data-testid="knowledge-pack-panel" data-status="server" aria-busy={busy} className="rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h3 className="font-semibold text-ink-900">企业知识包</h3>
        <p className="mt-1 text-sm leading-6 text-ink-500">按当前工作区组织批量导入文档。删除知识包默认保留文档，不会跨工作区访问数据。</p>
      </div>

      <form onSubmit={submitCreate} className="mt-4 grid gap-3 md:grid-cols-[minmax(180px,0.6fr)_minmax(240px,1fr)_auto]">
        <label className="text-sm text-ink-700">
          <span className="font-medium">名称</span>
          <input data-testid="knowledge-pack-name" aria-label="新知识包名称" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </label>
        <label className="text-sm text-ink-700">
          <span className="font-medium">说明（可选）</span>
          <input aria-label="新知识包说明" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </label>
        <button data-testid="knowledge-pack-create" disabled={busy} className="self-end rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-slate-400">新建知识包</button>
      </form>

      {localError ? <p role="alert" className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{localError}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {packs.map((pack) => (
          <article key={pack.id} data-testid={`knowledge-pack-${pack.id}`} data-status={pack.status} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            {editingId === pack.id ? (
              <div className="space-y-3">
                <input aria-label="知识包名称" value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={160} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <textarea aria-label="知识包说明" value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} rows={3} maxLength={1000} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void saveEditing(pack)} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">保存</button>
                  <button type="button" onClick={() => setEditingId("")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-ink-600">取消</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h4 className="break-words font-semibold text-ink-900">{pack.name}</h4><p className="mt-1 break-words text-sm text-ink-500">{pack.description || "暂无说明"}</p></div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                    <span className={pack.status === "active" ? "rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-100" : "rounded bg-slate-100 px-2 py-1 font-semibold text-ink-500 ring-1 ring-slate-200"}>{packStatusLabel[pack.status]}</span>
                    <span className="rounded bg-white px-2 py-1 tabular-nums text-ink-500 ring-1 ring-slate-200">{pack.documentCount} 篇</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-ink-500">更新于 {formatUpdatedAt(pack.updatedAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => startEditing(pack)} className="rounded-md border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700">编辑</button>
                  <button type="button" disabled={busy || Boolean(removingPackId)} onClick={() => setRemovingPack(pack)} className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50">{removingPackId === pack.id ? "正在删除…" : "删除并保留文档"}</button>
                </div>
              </>
            )}
          </article>
        ))}
        {!packs.length ? <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">暂无企业知识包，可先创建一个再批量导入。</p> : null}
      </div>
      <ConfirmDialog open={Boolean(removingPack)} title="删除这个知识包？" description={removingPack ? `“${removingPack.name}”将被删除，包内文档会保留并移出该知识包。` : ""} confirmLabel="删除并保留文档" danger onCancel={() => setRemovingPack(null)} onConfirm={() => void removeSelectedPack()} />
    </section>
  );
}
