// src/components/layout/AppShell.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LanguageDropdown from "@/components/LanguageDropdown";
import {
  getSystemSettingBool,
  getSystemSettingString,
} from "@/utils/systemSettings";
import ProfileMenu from "@/components/layout/ProfileMenu";

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
  const router = useRouter();

  const [siteName, setSiteName] = useState("DR4X");
  const [logoUrl, setLogoUrl] = useState<string>("/dr4x-logo.png");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [flashGifUrl, setFlashGifUrl] = useState<string>("");

  // شعار
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

  const logoSource = logoError ? "/dr4x-logo.png" : logoUrl || "/dr4x-logo.png";

  return (
    <div className="min-h-dvh bg-slate-50 h-dvh overflow-hidden">
      <div className="mx-auto w-full max-w-[1400px] px-3 md:px-6 h-dvh overflow-hidden">
        <div className="dr4x-shell py-4 h-dvh overflow-hidden">
          {/* الشريط الرئيسي (العمود الأيمن) */}
          {/* ✅ مخفي في الموبايل – يظهر من md وفوق */}
          <aside className="dr4x-col-sidebar hidden md:block">
            <div className="sticky top-4">
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
                        setLogoError(true);
                      }}
                    />
                  </div>
                  <div className="text-base font-extrabold tracking-wide">
                    {siteName}
                  </div>
                </Link>

                {/* وميض عام */}
                {flashEnabled && flashGifUrl ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold text-slate-700">
                        تنبيه
                      </div>
                      <div className="text-xs text-slate-500">(من الإدارة)</div>
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

          {/* العمود الأوسط */}
          <main className="dr4x-col-feed h-[calc(100dvh-2rem)] overflow-hidden">
            <div className="dr4x-card overflow-hidden h-full flex flex-col">
              {/* الهيدر ثابت */}
              <div className="border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-10">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {header ?? "الرئيسية"}
                  </div>
                  <div className="flex items-center gap-2">
                    <LanguageDropdown />

                    {/* ✅ منيو البروفايل – الموبايل فقط */}
                    <ProfileMenu className="md:hidden" />
                  </div>
                </div>
              </div>

              {/* منطقة المحتوى القابلة للتمرير */}
              <div
                className="bg-white overflow-y-auto flex-1 dr4x-no-scrollbar"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {children}
              </div>

              {/* ✅ شريط أزرار أسفل الشاشة (للموبايل فقط) */}
              <div className="border-t border-slate-200 bg-white px-2 py-2 md:hidden">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => router.push("/home")}
                    className="flex-1 px-2 py-2 rounded-full bg-slate-100 text-slate-800"
                  >
                    الرئيسية
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/category")}
                    className="flex-1 px-2 py-2 rounded-full bg-slate-100 text-slate-800"
                  >
                    التخصصات
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/doctors")}
                    className="flex-1 px-2 py-2 rounded-full bg-slate-100 text-slate-800"
                  >
                    الأطباء
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/notifications")}
                    className="flex-1 px-2 py-2 rounded-full bg-slate-100 text-slate-800"
                  >
                    التنبيهات
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/messages")}
                    className="flex-1 px-2 py-2 rounded-full bg-slate-100 text-slate-800"
                  >
                    الرسائل
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/auth/login")}
                    className="flex-1 px-2 py-2 rounded-full bg-red-100 text-red-700"
                  >
                    خروج
                  </button>
                </div>
              </div>
            </div>
          </main>

          {/* العمود الأيسر: البانل الجانبي – يظهر فقط من lg وفوق */}
          <aside className="dr4x-col-panel hidden lg:block">
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
