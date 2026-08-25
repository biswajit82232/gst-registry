"use client";

import { useRef } from "react";

const MIN_DX = 48;
const RATIO = 1.25;

export function useHorizontalSwipe(onSwipe: (dir: "left" | "right") => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const ignoreClick = useRef(false);
  const fired = useRef(false);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    fired.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* element may not support capture */
    }
  }

  function maybeSwipe(e: React.PointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId || fired.current) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * RATIO) return;
    fired.current = true;
    ignoreClick.current = true;
    start.current = null;
    onSwipeRef.current(dx < 0 ? "left" : "right");
  }

  function onPointerUp(e: React.PointerEvent) {
    maybeSwipe(e);
    if (start.current?.id === e.pointerId) start.current = null;
  }

  function onClickCapture(e: React.MouseEvent) {
    if (!ignoreClick.current) return;
    ignoreClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return {
    onPointerDown,
    onPointerMove: maybeSwipe,
    onPointerUp,
    onPointerCancel: () => {
      start.current = null;
    },
    onClickCapture,
  };
}
