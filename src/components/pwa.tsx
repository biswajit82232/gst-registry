"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
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
      <div className="rounded-md border border-line bg-bg-elev px-2 py-1.5">
        <p className="text-[13px] font-medium">Installed on this device</p>
        <p className="text-[11px] text-muted">Bills stay on the phone if the network drops.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-line bg-bg-elev px-2 py-2">
      <p className="text-[13px] font-medium">Install app</p>
      {promptEvent ? (
        <>
          <p className="text-[11px] text-muted">Add GST Registry to the home screen like a normal app.</p>
          <Button
            type="button"
            className="w-full min-h-11"
            onClick={async () => {
              await promptEvent.prompt();
              const choice = await promptEvent.userChoice;
              if (choice.outcome === "accepted") setInstalled(true);
              setPromptEvent(null);
            }}
          >
            Install
          </Button>
        </>
      ) : ios ? (
        <p className="text-[11px] leading-snug text-muted">
          Safari → Share → <span className="font-medium text-ink">Add to Home Screen</span>.
        </p>
      ) : (
        <p className="text-[11px] leading-snug text-muted">
          In Chrome, open the menu and choose <span className="font-medium text-ink">Install app</span> or{" "}
          <span className="font-medium text-ink">Add to Home screen</span>.
        </p>
      )}
    </div>
  );
}
