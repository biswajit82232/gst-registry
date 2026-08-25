"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "./brand";
import { Button } from "./ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isFormField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest("input, textarea, select, [contenteditable='true'], .selectable"));
}

function themeColor(): string {
  return document.documentElement.classList.contains("dark") ? "#11110f" : "#f7f6f3";
}

function syncThemeColor() {
  const color = themeColor();
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", color);
  }
}

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    }

    const root = document.documentElement;
    const applyStandalone = () => root.classList.toggle("standalone", isStandalone());
    applyStandalone();

    const onContextMenu = (event: Event) => {
      if (!isStandalone() && !window.matchMedia("(pointer: coarse)").matches) return;
      if (isFormField(event.target)) return;
      event.preventDefault();
    };
    const onDragStart = (event: DragEvent) => {
      if (isFormField(event.target)) return;
      event.preventDefault();
    };
    const onGesture = (event: Event) => {
      event.preventDefault();
    };

    syncThemeColor();
    const themeWatch = new MutationObserver(syncThemeColor);
    themeWatch.observe(root, { attributes: true, attributeFilter: ["class"] });

    const standaloneWatch = window.matchMedia("(display-mode: standalone)");
    standaloneWatch.addEventListener("change", applyStandalone);

    document.addEventListener("contextmenu", onContextMenu, { capture: true });
    document.addEventListener("dragstart", onDragStart, { capture: true });
    document.addEventListener("gesturestart", onGesture, { capture: true } as AddEventListenerOptions);
    document.addEventListener("gesturechange", onGesture, { capture: true } as AddEventListenerOptions);

    return () => {
      themeWatch.disconnect();
      standaloneWatch.removeEventListener("change", applyStandalone);
      document.removeEventListener("contextmenu", onContextMenu, { capture: true });
      document.removeEventListener("dragstart", onDragStart, { capture: true });
      document.removeEventListener("gesturestart", onGesture, { capture: true } as AddEventListenerOptions);
      document.removeEventListener("gesturechange", onGesture, { capture: true } as AddEventListenerOptions);
      root.classList.remove("standalone");
    };
  }, []);
  return null;
}

export function InstallCard() {
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIos());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || installed) {
    return (
      <div>
        <p className="text-[15px] font-medium">Installed on this device</p>
        <p className="mt-1 text-[13px] text-muted">Bills stay on the phone if the network drops.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <BrandMark size={40} className="shrink-0" alt="" />
        <div>
          <p className="text-[15px] font-medium">Install app</p>
          {promptEvent ? (
            <p className="mt-0.5 text-[13px] text-muted">Add GST Registry to the home screen like a normal app.</p>
          ) : null}
        </div>
      </div>
      {promptEvent ? (
        <Button
          type="button"
          className="w-full"
          onClick={async () => {
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setPromptEvent(null);
          }}
        >
          Install
        </Button>
      ) : ios ? (
        <p className="text-[13px] leading-snug text-muted">
          Safari → Share → <span className="font-medium text-ink">Add to Home Screen</span>.
        </p>
      ) : (
        <p className="text-[13px] leading-snug text-muted">
          In Chrome, open the menu and choose <span className="font-medium text-ink">Install app</span> or{" "}
          <span className="font-medium text-ink">Add to Home screen</span>.
        </p>
      )}
    </div>
  );
}
