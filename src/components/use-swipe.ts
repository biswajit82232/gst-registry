"use client";

import { useEffect, useRef } from "react";

const MIN_DX = 48;
const RATIO = 1.25;

export function useHorizontalSwipe(onSwipe: (dir: "left" | "right") => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const ignoreClick = useRef(false);
  const fired = useRef(false);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const unbind = useRef<() => void>(() => {});

  useEffect(() => {
    return () => unbind.current();
  }, []);

  function consider(x: number, y: number) {
    const s = start.current;
    if (!s || fired.current) return;
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * RATIO) return;
    fired.current = true;
    ignoreClick.current = true;
    start.current = null;
    unbind.current();
    onSwipeRef.current(dx < 0 ? "left" : "right");
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select")) return;
    start.current = { x: e.clientX, y: e.clientY };
    fired.current = false;
    const onMove = (ev: PointerEvent) => consider(ev.clientX, ev.clientY);
    const onUp = () => {
      start.current = null;
      unbind.current();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    unbind.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* element may not support capture */
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    if (!t) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select")) return;
    if (start.current) return;
    start.current = { x: t.clientX, y: t.clientY };
    fired.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    if (!t) return;
    consider(t.clientX, t.clientY);
  }

  function onTouchEnd() {
    if (!fired.current) start.current = null;
  }

  function onClickCapture(e: React.MouseEvent) {
    if (!ignoreClick.current) return;
    ignoreClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return {
    onPointerDown,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
    onClickCapture,
  };
}
