"use client";

import { useRef } from "react";

const MIN_DX = 56;
const RATIO = 1.35;

export function useHorizontalSwipe(onSwipe: (dir: "left" | "right") => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const ignoreClick = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("[role='tablist'], input, textarea, select")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* element may not support capture */
    }
  }

  function finish(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * RATIO) return;
    ignoreClick.current = true;
    onSwipe(dx < 0 ? "left" : "right");
  }

  function onClickCapture(e: React.MouseEvent) {
    if (!ignoreClick.current) return;
    ignoreClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return {
    onPointerDown,
    onPointerUp: finish,
    onPointerCancel: () => {
      start.current = null;
    },
    onClickCapture,
  };
}
