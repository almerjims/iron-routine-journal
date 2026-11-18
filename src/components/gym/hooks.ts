import { useEffect, useRef, useState, type PointerEvent } from "react";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * Pointer-based drag reorder (works with touch and mouse).
 * Put data-drag-list={listId} data-drag-index={i} on each row and spread handleProps(i) on the handle.
 */
export function useDragReorder(listId: string, onMove: (from: number, to: number) => void) {
  const current = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const handleProps = (index: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      current.current = index;
      setDragging(index);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (current.current == null) return;
      const el = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((x) => x.closest(`[data-drag-list="${listId}"]`))
        .find(Boolean) as HTMLElement | undefined;
      if (!el) return;
      const to = Number(el.dataset["dragIndex"]);
      if (!Number.isNaN(to) && to !== current.current) {
        onMove(current.current, to);
        current.current = to;
        setDragging(to);
      }
    },
    onPointerUp: () => {
      current.current = null;
      setDragging(null);
    },
    onPointerCancel: () => {
      current.current = null;
      setDragging(null);
    },
    style: { touchAction: "none" as const, cursor: "grab" },
    "aria-label": "Drag to reorder",
  });
  return { dragging, handleProps };
}
