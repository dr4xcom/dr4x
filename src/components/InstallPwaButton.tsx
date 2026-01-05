// src/components/InstallPwaButton.tsx
"use client";

import React, { useEffect, useState } from "react";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const isStandalone =
      (window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      // iOS
      (window.navigator as any).standalone === true;

    // لو هو فاتح التطبيق كـ PWA فعلاً ما نعرض الزر
    if (isStandalone) {
      setHidden(true);
      return;
    }

    function handleBeforeInstall(e: BeforeInstallPromptEvent) {
      e.preventDefault();
      setDeferredPrompt(e);
      setHidden(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  if (hidden) return null;

  async function handleClick() {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } finally {
        setDeferredPrompt(null);
      }
      return;
    }

    // لو ما فيه حدث beforeinstallprompt نعرض ملاحظة عامة
    setShowHint(true);
    setTimeout(() => setShowHint(false), 8000);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/20 hover:border-emerald-400 transition"
      >
        تثبيت تطبيق DR4X 📲
      </button>

      {showHint && (
        <div className="max-w-xs rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 leading-relaxed text-center">
          يمكنك إضافة الموقع إلى الشاشة الرئيسية من إعدادات المتصفح
          (Install App / Add to Home Screen) ثم ستظهر أيقونة DR4X على جوالك.
        </div>
      )}
    </div>
  );
}
