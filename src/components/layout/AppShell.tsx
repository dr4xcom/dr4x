// src/components/layout/AppShell.tsx
"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LanguageDropdown from "@/components/LanguageDropdown";
import {
  getSystemSettingBool,
  getSystemSettingString,
} from "@/utils/systemSettings";
import { supabase } from "@/utils/supabase/client";

type ProfileLite = {
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
};

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

  // بروفايل للهيدر (للموبايل)
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

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

  // تحميل بروفايل مختصر للهيدر (موبايل)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingProfile(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!alive) return;

        if (!user) {
          setProfile(null);
          setLoadingProfile(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, username, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.error("AppShell profiles error", error);
        }

        setProfile({
          full_name: data?.full_name ?? null,
          username: data?.username ?? null,
          email: user.email ?? null,
          avatar_url: data?.avatar_url ?? null,
        });
      } catch (e) {
        console.error("AppShell load profile error", e);
      } finally {
        if (alive) setLoadingProfile(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // إغلاق منيو البروفايل عند الضغط خارجها أو زر Esc
  useEffect(() => {
    if (!profileMenuOpen) return;

    function onClick(e: MouseEvent) {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileMenuOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileMenuOpen]);

  const logoSource = logoError ? "/dr4x-logo.png" : logoUrl || "/dr4x-logo.png";

  const displayName = useMemo(() => {
    if (!profile) return "مستخدم";
    return (
      profile.full_name?.trim() ||
      profile.username?.trim() ||
      (profile.email ? profile.email.split("@")[0] : "") ||
      "مستخدم"
    );
  }, [profile]);

  const handleName = useMemo(() => {
    if (!profile) return "";
    return (
      profile.username?.trim() ||
      (profile.email ? profile.email.split("@")[0] : "") ||
      ""
    );
  }, [profile]);

  const initials = useMemo(() => {
    const s = displayName.trim();
    return ((s[0] ?? "D") + (s[1] ?? "R")).toUpperCase();
  }, [displayName]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/auth/login");
    }
  }

  function goPublicProfile() {
    if (!profile) {
      router.push("/profile");
      return;
    }
    const u = (profile.username ?? "").trim();
    if (!u) {
      router.push("/profile");
      return;
    }
    router.push(`/u/${encodeURIComponent(u)}`);
  }

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

                    {/* ✅ أيقونة البروفايل (تظهر في الموبايل فقط) */}
                    <div className="relative md:hidden" ref={profileMenuRef}>
                      <button
                        type="button"
                        onClick={() => setProfileMenuOpen((v) => !v)}
                        className="h-9 w-9 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-bold overflow-hidden"
                        title="القائمة الشخصية"
                      >
                        {loadingProfile ? (
                          "••"
                        ) : profile?.avatar_url ? (
                          <Image
                            src={profile.avatar_url}
                            alt={displayName}
                            width={36}
                            height={36}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </button>

                      {profileMenuOpen && (
                        <div className="absolute end-0 mt-2 w-44 rounded-2xl border bg-white shadow-lg overflow-hidden text-sm">
                          <div className="px-3 py-2 border-b border-slate-100">
                            <div className="font-semibold truncate">
                              {loadingProfile ? "..." : displayName}
                            </div>
                            {handleName && !loadingProfile ? (
                              <div className="text-xs text-slate-500 truncate">
                                @{handleName}
                              </div>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              goPublicProfile();
                            }}
                            className="w-full text-start px-4 py-2 hover:bg-slate-50"
                          >
                            ملفي الشخصي
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              router.push("/admin");
                            }}
                            className="w-full text-start px-4 py-2 hover:bg-slate-50"
                          >
                            لوحة التحكم
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              router.push("/patient/profile");
                            }}
                            className="w-full text-start px-4 py-2 hover:bg-slate-50"
                          >
                            ملفي الصحي
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              router.push("/settings");
                            }}
                            className="w-full text-start px-4 py-2 hover:bg-slate-50"
                          >
                            الإعدادات
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              handleLogout();
                            }}
                            className="w-full text-start px-4 py-2 text-red-600 hover:bg-slate-50"
                          >
                            خروج
                          </button>
                        </div>
                      )}
                    </div>
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
                    onClick={handleLogout}
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
