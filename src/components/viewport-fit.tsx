"use client";

import { useEffect } from "react";

export function ViewportFit() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    function apply() {
      const layoutH = window.innerHeight;
      const visualH = vv?.height ?? layoutH;
      const offsetTop = vv?.offsetTop ?? 0;
      const keyboard = Math.max(0, Math.round(layoutH - visualH - offsetTop));
      root.style.setProperty("--keyboard-inset", `${keyboard}px`);
      root.classList.toggle("kb-open", keyboard > 80);
    }

    apply();
    window.addEventListener("resize", apply);
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    return () => {
      window.removeEventListener("resize", apply);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      root.classList.remove("kb-open");
      root.style.setProperty("--keyboard-inset", "0px");
    };
  }, []);

  return null;
}
