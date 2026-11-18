import type { Block } from "./types";
import { uid } from "./id";

type HasId = { id: string };

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function nextGroupName<T>(blocks: Block<T>[]) {
  const used = new Set(blocks.filter((b) => b.kind === "group").map((b) => b.name));
  for (const l of LETTERS) if (!used.has(`Superset ${l}`)) return `Superset ${l}`;
  return "Superset";
}

/** Index of a group among the group blocks (for color + letter). */
export function groupIndex<T>(blocks: Block<T>[], blockId: string) {
  return blocks.filter((b) => b.kind === "group").findIndex((b) => b.id === blockId);
}

export function singleBlock<T>(item: T): Block<T> {
  return { id: uid(), kind: "single", name: "", restSeconds: null, items: [item] };
}

/** Remove empty blocks and auto-ungroup groups that dropped below 2 items. */
export function normalize<T>(blocks: Block<T>[]): Block<T>[] {
  return blocks
    .filter((b) => b.items.length > 0)
    .map((b) =>
      b.kind === "group" && b.items.length < 2
        ? { ...b, kind: "single" as const, name: "", restSeconds: null }
        : b,
    );
}

export function moveIndex<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x as T);
  return a;
}

export function groupItems<T extends HasId>(
  blocks: Block<T>[],
  itemIds: string[],
  name?: string,
): Block<T>[] {
  const picked: T[] = [];
  let insertAt = -1;
  blocks.forEach((b, bi) =>
    b.items.forEach((it) => {
      if (itemIds.includes(it.id)) {
        picked.push(it);
        if (insertAt < 0) insertAt = bi;
      }
    }),
  );
  if (picked.length < 2) return blocks;
  const remaining = blocks.map((b) => ({ ...b, items: b.items.filter((it) => !itemIds.includes(it.id)) }));
  remaining.splice(insertAt, 0, {
    id: uid(),
    kind: "group",
    name: name?.trim() || nextGroupName(blocks),
    restSeconds: null,
    items: picked,
  });
  return normalize(remaining);
}

export function ungroup<T>(blocks: Block<T>[], blockId: string): Block<T>[] {
  return blocks.flatMap((b) => (b.id === blockId ? b.items.map((it) => singleBlock(it)) : [b]));
}

export function removeItem<T extends HasId>(blocks: Block<T>[], itemId: string): Block<T>[] {
  return normalize(blocks.map((b) => ({ ...b, items: b.items.filter((i) => i.id !== itemId) })));
}

export function moveItemOutOfGroup<T extends HasId>(blocks: Block<T>[], blockId: string, itemId: string) {
  const out: Block<T>[] = [];
  for (const b of blocks) {
    if (b.id !== blockId) {
      out.push(b);
      continue;
    }
    const item = b.items.find((i) => i.id === itemId);
    out.push({ ...b, items: b.items.filter((i) => i.id !== itemId) });
    if (item) out.push(singleBlock(item));
  }
  return normalize(out);
}

export function moveItemWithin<T>(blocks: Block<T>[], blockId: string, from: number, to: number) {
  return blocks.map((b) => (b.id === blockId ? { ...b, items: moveIndex(b.items, from, to) } : b));
}

export function addItemsToGroup<T>(blocks: Block<T>[], blockId: string, items: T[]) {
  return blocks.map((b) => (b.id === blockId ? { ...b, items: [...b.items, ...items] } : b));
}

/** Group a single block with the block right after it. */
export function groupWithNext<T extends HasId>(blocks: Block<T>[], blockId: string) {
  const i = blocks.findIndex((b) => b.id === blockId);
  if (i < 0 || i >= blocks.length - 1) return blocks;
  const next = blocks[i + 1]!;
  const cur = blocks[i]!;
  if (next.kind === "group") {
    // join the following group
    const merged = { ...next, items: [...cur.items, ...next.items] };
    return [...blocks.slice(0, i), merged, ...blocks.slice(i + 2)];
  }
  return groupItems(blocks, [...cur.items, ...next.items].map((x) => x.id));
}
