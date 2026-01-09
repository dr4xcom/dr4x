// src/components/admin/AdminShell.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSystemSettingString } from "@/utils/systemSettings";

const NAV = [
  { href: "/admin", label: "لوحة التحكم" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/doctors", label: "الأطباء" },
  { href: "/admin/patients", label: "المرضى" },
  { href: "/admin/consultations", label: "الاستشارات" },
  { href: "/admin/departments", label: "الأقسام" },
  { href: "/admin/specialties", label: "التخصصات" },
  { href: "/admin/posts", label: "التغريدات" },
  { href: "/admin/library", label: "المكتبة" },
  { href: "/admin/profile-center", label: "صورة البروفايل العامة" }, // ✅ جديد
  { href: "/admin/settings", label: "الإعدادات" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [siteName, setSiteName] = useState("DR4X");
  const [siteLogoUrl, setSiteLogoUrl] = useState<string>("/dr4x-logo.png");

  // ✅ حالة صورة GIF لغرفة الكشف (محلية – بدون لمس الـ DB الآن)
  const [examGifPreview, setExamGifPreview] = useState<string | null>(null);
  const [examGifEnabled, setExamGifEnabled] = useState(true);
  const [gifError, setGifError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [n, logo] = await Promise.all([
          getSystemSettingString("site_name", "DRX"),
          getSystemSettingString("site_logo_url", ""),
        ]);

        if (!alive) return;

        const finalName = (n || "DRX").trim() || "DRX";
        const finalLogo = (logo || "").trim();

        setSiteName(finalName);
        setSiteLogoUrl(finalLogo || "/dr4x-logo.png");
      } catch {
        if (!alive) return;
        setSiteName("DRX");
        setSiteLogoUrl("/dr4x-logo.png");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ✅ تنظيف رابط الـ GIF عند التغيير/الإغلاق
  useEffect(() => {
    return () => {
      if (examGifPreview) {
        URL.revokeObjectURL(examGifPreview);
      }
    };
  }, [examGifPreview]);

  function handleGifChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setGifError(null);

    if (file.type !== "image/gif") {
      setGifError("مسموح فقط بصور GIF المتحركة.");
      return;
    }

    // ✅ حد الحجم (مثلاً 1MB) حتى لا تثقل الصفحة
    const maxBytes = 1024 * 1024 * 1; // 1MB
    if (file.size > maxBytes) {
      setGifError("حجم الملف كبير. الحد الأقصى 1MB تقريباً.");
      return;
    }

    // حذف الـ URL السابق (لو موجود) ثم إنشاء جديد
    setExamGifPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setExamGifEnabled(true);
  }

  function handleGifClear() {
    setExamGifPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setGifError(null);
  }

  return (
    <div className="min-h-screen text-slate-100 bg-slate-950 bg-[radial-gradient(circle_at_top,_#0f172a_0,_#020617_45%,_#000_100%)]">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-emerald-700/50 bg-slate-950/90 backdrop-blur shadow-[0_0_30px_rgba(16,185,129,0.25)]">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteLogoUrl}
              alt={siteName}
              className="h-9 w-9 rounded-full border border-emerald-500/60 bg-slate-900 object-cover shadow-[0_0_20px_rgba(16,185,129,0.5)]"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.src = "/dr4x-logo.png";
              }}
            />
            <div className="leading-tight">
              <div className="text-xs text-emerald-400/80">{siteName}</div>
              <div className="text-sm font-extrabold tracking-wide text-emerald-300">
                Admin Dashboard
              </div>
            </div>
          </div>

          <Link
            href="/home"
            className="rounded-xl border border-emerald-500/40 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/20 hover:border-emerald-400 transition"
          >
            الرجوع للموقع ➜
          </Link>
        </div>
      </div>

      {/* Layout */}
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* Sidebar */}
        <aside className="rounded-2xl border border-emerald-700/40 bg-slate-950/70 p-3 shadow-[0_0_35px_rgba(16,185,129,0.25)]">
          <div className="mb-3 px-2 text-xs text-emerald-300/80">الأقسام</div>

          <nav className="space-y-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block rounded-xl px-3 py-2 text-sm font-semibold transition border border-transparent",
                    active
                      ? "bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.7)]"
                      : "text-emerald-100 hover:bg-slate-900/80 hover:border-emerald-600/60",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* ملاحظة قديمة – لم تُمس */}
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="text-xs text-emerald-300 mb-1">ملاحظة</div>
            <div className="text-xs text-slate-300">
              كل صلاحيات الأدمن تُحسم عبر RPC (is_admin / admin_dashboard_counts).
            </div>
          </div>

          {/* ✅ لوحة صورة غرفة الكشف (GIF) – محلية، لا تلمس الـ DB */}
          <div className="mt-4 rounded-xl border border-emerald-700/60 bg-black/70 p-3 space-y-2">
            <div className="text-xs font-semibold text-emerald-300">
              صورة غرفة الكشف (GIF)
            </div>
            <p className="text-[11px] text-emerald-200/70 leading-relaxed">
              يمكنك اختيار صورة GIF خفيفة (مثلاً إضاءة إسعاف) لاستخدامها في غرفة
              الكشف. الحد الأقصى ~1MB للحفاظ على سرعة المتصفح.
            </p>

            <label className="mt-1 inline-flex items-center justify-center rounded-lg border border-emerald-500/60 bg-slate-950/80 px-3 py-2 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-600/10 cursor-pointer">
              اختيار ملف GIF من الجهاز
              <input
                type="file"
                accept="image/gif"
                className="hidden"
                onChange={handleGifChange}
              />
            </label>

            {gifError ? (
              <div className="text-[11px] text-red-300">{gifError}</div>
            ) : null}

            {examGifPreview && (
              <div className="mt-2 space-y-2">
                <div className="text-[11px] text-emerald-200/80">
                  المعاينة (لن يتم الحفظ في السيرفر حالياً – عرض فقط):
                </div>
                <div className="overflow-hidden rounded-lg border border-emerald-600/60 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {examGifEnabled ? (
                    <img
                      src={examGifPreview}
                      alt="Exam room GIF preview"
                      className="w-full h-24 object-cover"
                    />
                  ) : (
                    <div className="w-full h-24 grid place-items-center text-[11px] text-emerald-300">
                      الصورة مخفية حاليًا
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExamGifEnabled((v) => !v)}
                    className="flex-1 rounded-lg border border-emerald-600/70 bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-600/10"
                  >
                    {examGifEnabled ? "إخفاء في الواجهة" : "إظهار في الواجهة"}
                  </button>

                  <button
                    type="button"
                    onClick={handleGifClear}
                    className="flex-1 rounded-lg border border-red-500/70 bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-600/20"
                  >
                    حذف الصورة
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Content */}
        <main className="rounded-2xl border border-emerald-700/50 bg-slate-950/80 p-4 sm:p-6 shadow-[0_0_45px_rgba(16,185,129,0.35)]">
          {children}
        </main>
      </div>
    </div>
  );
}
