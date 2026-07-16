import { describe, expect, it } from "vitest";
import { mergeConversationIntoStore, toConversationStore } from "@/lib/storage/conversationStoreState";
import type { Conversation } from "@/types";

function conversation(id: string, revision = 0): Conversation {
  const createdAt = "2026-07-16T00:00:00.000Z";
  return { id, title: id, titleSource: "manual", createdAt, updatedAt: createdAt, revision, schemaVersion: 1, messages: [] };
}

describe("conversation store state", () => {
  it("merges an asynchronously updated inactive conversation without switching active conversation", () => {
    const active = conversation("active");
    const inactive = conversation("inactive");
    const store = toConversationStore([active, inactive], active.id);

    const merged = mergeConversationIntoStore(store, { ...inactive, title: "renamed", revision: 1 });

    expect(merged.activeConversationId).toBe(active.id);
    expect(merged.conversations.find((item) => item.id === inactive.id)).toMatchObject({ title: "renamed", revision: 1 });
  });

  it("activates an explicitly created conversation", () => {
    const store = toConversationStore([conversation("active")], "active");
    const created = conversation("created");

    expect(mergeConversationIntoStore(store, created, { activate: true }).activeConversationId).toBe(created.id);
  });
});
