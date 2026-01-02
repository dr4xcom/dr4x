// src/components/layout/AppShell.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LanguageDropdown from "@/components/LanguageDropdown";
import {
  getSystemSettingBool,
  getSystemSettingString,
} from "@/utils/systemSettings";

export default function AppShell({
  sidebar,
  header,
  children,
  rightPanel,
}: {
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}) {
  const [siteName, setSiteName] = useState("DR4X");
  const [logoUrl, setLogoUrl] = useState<string>("/dr4x-logo.png");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [flashGifUrl, setFlashGifUrl] = useState<string>("");

  // 🔹 نستخدم state إضافي فقط لمعالجة الخطأ في الشعار
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [n, l, fe, fg] = await Promise.all([
          getSystemSettingString("site_name", "DR4X"),
          getSystemSettingString("site_logo_url", ""),
          getSystemSettingBool("global_flash_enabled", false),
          getSystemSettingString("global_flash_gif_url", ""),
        ]);

        if (!alive) return;

        setSiteName((n || "DR4X").trim() || "DR4X");

        const cleanLogo = (l || "").trim();
        setLogoUrl(cleanLogo.length > 0 ? cleanLogo : "/dr4x-logo.png");

        setFlashEnabled(!!fe);
        setFlashGifUrl(fg || "");
      } catch {
        // نخلي الافتراضي لو حصل خطأ
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // المصدر الفعلي للصورة مع fallback
  const logoSource = logoError
    ? "/dr4x-logo.png"
    : logoUrl || "/dr4x-logo.png";

  return (
    <div className="min-h-dvh bg-slate-50 h-dvh overflow-hidden">
      <div className="mx-auto w-full max-w-[1400px] px-3 md:px-6 h-dvh overflow-hidden">
        <div className="dr4x-shell py-4 h-dvh overflow-hidden">
          {/* الشريط الرئيسي (العمود الأيمن) */}
          <aside className="dr4x-col-sidebar">
            <div className="sticky top-4">
              {/* كرت كامل بارتفاع الشاشة + داخله Scroll */}
              <div className="dr4x-card p-4 h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
                {/* الشعار + اسم الموقع */}
                <Link
                  href="/home"
                  className="flex items-center gap-3 hover:opacity-80 transition"
                >
                  <div className="h-16 w-16 rounded-full overflow-hidden border border-slate-200 bg-white">
                    <Image
                      src={logoSource}
                      alt={siteName}
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                      priority
                      unoptimized
                      onError={() => {
                        // لو خرب رابط الشعار من DB نرجع للصورة الافتراضية
                        setLogoError(true);
                      }}
                    />
                  </div>
                  <div className="text-base font-extrabold tracking-wide">
                    {siteName}
                  </div>
                </Link>

                {/* وميض / GIF عام للجميع */}
                {flashEnabled && flashGifUrl ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold text-slate-700">
                        تنبيه
                      </div>
                      <div className="text-xs text-slate-500">
                        (من الإدارة)
                      </div>
                    </div>
                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={flashGifUrl}
                        alt="flash"
                        className="w-full h-auto object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {/* محتوى الشريط (أزرار الهوم / المتابعة ... الخ) */}
                <div
                  className="mt-4 flex-1 overflow-y-auto dr4x-no-scrollbar"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {sidebar}
                </div>
              </div>
            </div>
          </aside>

          {/* العمود الأوسط: التايم لاين */}
          <main className="dr4x-col-feed h-[calc(100dvh-2rem)] overflow-hidden">
            <div className="dr4x-card overflow-hidden h-full flex flex-col">
              {/* الهيدر ثابت */}
              <div className="border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-10">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {header ?? "الرئيسية"}
                  </div>
                  <LanguageDropdown />
                </div>
              </div>

              {/* فقط هذه المنطقة تعمل Scroll */}
              <div
                className="bg-white overflow-y-auto flex-1 dr4x-no-scrollbar"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {children}
              </div>
            </div>
          </main>

          {/* العمود الأيسر: البانل الجانبي */}
          <aside className="dr4x-col-panel">
            <div className="sticky top-4">
              {rightPanel ? (
                <div className="dr4x-card p-4 h-[calc(100dvh-2rem)] overflow-hidden">
                  <div
                    className="h-full overflow-y-auto dr4x-no-scrollbar"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {rightPanel}
                  </div>
                </div>
              ) : (
                <div className="dr4x-card p-4 text-sm text-slate-600 h-[calc(100dvh-2rem)]">
                  هنا لاحقًا: الترند / اقتراحات / من تتابع
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
