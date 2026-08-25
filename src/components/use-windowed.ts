"use client";

import { useEffect, useState } from "react";

const PAGE = 80;

export function useWindowed<T>(items: T[], resetKey: string, page = PAGE) {
  const [shown, setShown] = useState(page);

  useEffect(() => {
    setShown(page);
  }, [resetKey, page]);

  return {
    visible: items.slice(0, shown),
    remaining: Math.max(0, items.length - shown),
    showMore: () => setShown((n) => n + page),
  };
}
