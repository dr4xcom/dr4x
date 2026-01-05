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
  const [canInstall, setCanInstall] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 👈 نكشف هل الجهاز iPhone / iPad
    const ios =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !(window.navigator as any).standalone;

    setIsIOS(ios);

    const isStandalone =
      (window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    function handleBeforeInstall(e: BeforeInstallPromptEvent) {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  async function handleClick() {
    // أندرويد → يظهر نافذة التثبيت
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setCanInstall(false);
      return;
    }

    // iPhone فقط → نظهر رسالة الشرح
    if (isIOS) {
      setShowIosHint(true);
      setTimeout(() => setShowIosHint(false), 8000);
    }
  }

  // نخفي الزر إذا لا يمكن تثبيته ولم يكن iOS
  if (!canInstall && !isIOS) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 hover:border-emerald-400 transition shadow-[0_0_18px_rgba(16,185,129,0.35)]"
      >
        تثبيت تطبيق DR4X 📲
      </button>

      {showIosHint && (
        <div className="max-w-xs rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-[11px] text-slate-200 leading-relaxed text-center">
          📱 <span className="font-semibold">على أجهزة الآيفون:</span><br />
          اضغط على زر <span className="font-semibold">المشاركة (Share)</span>،
          ثم اختر <span className="font-semibold">إضافة إلى الشاشة الرئيسية (Add to Home Screen)</span>.<br />
          بعد ذلك ستظهر أيقونة <span className="font-semibold">DR4X</span> كتطبيق على جوالك.
        </div>
      )}
    </div>
  );
}
