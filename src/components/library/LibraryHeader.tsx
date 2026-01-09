// src/components/library/LibraryHeader.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { getSystemSettingString } from "@/utils/systemSettings";

type Props = {
  title?: string;
  subtitle?: string;
  rightActionHref?: string;
  rightActionLabel?: string;
  className?: string;
};

export default function LibraryHeader({
  title,
  subtitle,
  rightActionHref,
  rightActionLabel,
  className = "",
}: Props) {
  const [logoUrl, setLogoUrl] = useState<string>("/dr4x-logo.png");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const url = await getSystemSettingString("site_logo_url", "");
        if (!alive) return;
        const finalUrl = (url || "").trim();
        setLogoUrl(finalUrl || "/dr4x-logo.png");
      } catch {
        if (!alive) return;
        setLogoUrl("/dr4x-logo.png");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      dir="rtl"
      className={`mb-5 w-full ${className}`}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(226,232,240,0.9)",
        paddingTop: 10,
        paddingBottom: 10,
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 flex items-center justify-between gap-3">
        {/* يسار: الشعار + رجوع */}
        <div className="flex items-center justify-start gap-3">
          {/* الشعار يرجع للرئيسية */}
          <Link href="/home" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="شعار الموقع"
              className="h-9 w-9 rounded-full border border-slate-200 bg-white object-cover"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.src = "/dr4x-logo.png";
              }}
            />
          </Link>

          <Link
            href="/home"
            dir="ltr"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <span>رجوع للتغريدة</span>
            <span className="text-base">➜</span>
          </Link>

          {/* ✅ عنوان المكتبة اختياري (بدون تغيير تصميمك الأساسي) */}
          {title ? (
            <div className="hidden sm:block">
              <div className="text-base font-extrabold text-slate-900">
                {title}
              </div>
              {subtitle ? (
                <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ✅ زر يمين اختياري */}
        {rightActionHref && rightActionLabel ? (
          <Link
            href={rightActionHref}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {rightActionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
