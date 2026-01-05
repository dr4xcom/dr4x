// src/app/home/page.tsx
"use client";

import AppShell from "@/components/layout/AppShell";
import { Home, Search, Stethoscope, Mail, Bell, BookOpen } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

import PostsFeed from "@/components/posts/PostsFeed";
import PostComposerModal from "@/components/posts/PostComposerModal";
import NewPostComposer from "@/components/posts/NewPostComposer";
import HomeLibraryWidget from "@/components/library/HomeLibraryWidget";

/* ========================= Sidebar Button ========================= */
function SidebarButton({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  const hasBadge = typeof badge === "number" && badge > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-base",
        "hover:bg-slate-50 transition",
        active ? "font-semibold" : "font-medium text-slate-800",
      ].join(" ")}
    >
      <span className="text-xl leading-none relative">
        {icon}
        {hasBadge && (
          <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-[11px] text-slate-900 grid place-items-center px-1">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="flex-1 text-start">{label}</span>
    </button>
  );
}

/* ========================= Types ========================= */
type ProfileLite = {
  full_name: string | null;
  username: string | null;
  email: string | null;
};

/* ========================= Sidebar ========================= */
function SidebarMock({ onOpenComposer }: { onOpenComposer: () => void }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [profile, setProfile] = useState<ProfileLite>({
    full_name: null,
    username: null,
    email: null,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [dmUnread, setDmUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfileAndCounts() {
      try {
        setLoadingProfile(true);

        const {
          data: { user },
          error: uErr,
        } = await supabase.auth.getUser();

        if (uErr) {
          console.error("getUser error", uErr);
        }

        if (!mounted) return;

        if (!user) {
          // مستخدم غير مسجّل
          setProfile({
            full_name: null,
            username: null,
            email: null,
          });
          setDmUnread(0);
          setNotifUnread(0);
          setLoadingProfile(false);
          return;
        }

        // بروفايل مختصر
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error("profiles error", error);
        }

        setProfile({
          full_name: data?.full_name ?? null,
          username: data?.username ?? null,
          email: user.email ?? null,
        });

        // عدد الرسائل والتنبيهات غير المقروءة
        try {
          const [dmRes, notifRes] = await Promise.all([
            supabase.rpc("user_unread_dm_count"),
            supabase.rpc("user_unread_notification_count"),
          ]);

          if (!mounted) return;

          if (!dmRes.error && typeof dmRes.data === "number") {
            setDmUnread(dmRes.data);
          } else if (dmRes.error) {
            console.error("user_unread_dm_count error", dmRes.error);
          }

          if (!notifRes.error && typeof notifRes.data === "number") {
            setNotifUnread(notifRes.data);
          } else if (notifRes.error) {
            console.error(
              "user_unread_notification_count error",
              notifRes.error
            );
          }
        } catch (e) {
          console.error("unread counts error", e);
        }
      } finally {
        if (mounted) {
          setLoadingProfile(false);
        }
      }
    }

    loadProfileAndCounts();

    return () => {
      mounted = false;
    };
  }, []);

  // إغلاق المنيو عند الضغط خارجها أو زر Escape
  useEffect(() => {
    if (!menuOpen) return;

    function onClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const displayName = useMemo(
    () =>
      profile.full_name?.trim() ||
      profile.username?.trim() ||
      (profile.email ? profile.email.split("@")[0] : "") ||
      "مستخدم",
    [profile]
  );

  const handle = useMemo(
    () =>
      profile.username?.trim() ||
      (profile.email ? profile.email.split("@")[0] : ""),
    [profile]
  );

  const initials = useMemo(() => {
    const s = displayName.trim();
    return ((s[0] ?? "D") + (s[1] ?? "R")).toUpperCase();
  }, [displayName]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  // ✅ رابط البروفايل العام يعتمد على username فقط
  function goPublicProfile() {
    const u = (profile.username ?? "").trim();
    if (!u) {
      router.push("/profile");
      return;
    }
    router.push(`/u/${encodeURIComponent(u)}`);
  }

  return (
    <nav className="space-y-2">
      <SidebarButton
        icon={<Home className="h-5 w-5" />}
        label="الرئيسية"
        active
        onClick={() => router.push("/home")}
      />

      <SidebarButton
        icon={<Search className="h-5 w-5" />}
        label="التخصصات"
        onClick={() => router.push("/category")} // ⬅️ الزر الجديد
      />

      <SidebarButton
        icon={<Stethoscope className="h-5 w-5" />}
        label="الأطباء"
      />

      {/* ✅ زر المكتبة جنب بقية الأزرار بدون تغيير أي تصميم آخر */}
      <SidebarButton
        icon={<BookOpen className="h-5 w-5" />}
        label="المكتبة"
        onClick={() => router.push("/library")}
      />

      <SidebarButton
        icon={<Bell className="h-5 w-5" />}
        label="التنبيهات"
        badge={notifUnread}
        onClick={() => router.push("/notifications")}
      />

      <SidebarButton
        icon={<Mail className="h-5 w-5" />}
        label="الرسائل"
        badge={dmUnread}
        onClick={() => router.push("/messages")}
      />

      <div className="pt-4">
        <button
          onClick={onOpenComposer}
          className="w-full rounded-full bg-slate-900 text-white py-3 font-semibold hover:opacity-95 transition"
        >
          نشر
        </button>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-slate-50 transition">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-bold">
              {loadingProfile ? "••" : initials}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {loadingProfile ? "..." : displayName}
              </div>
              {handle && !loadingProfile && (
                <div className="text-xs text-slate-500 truncate">@{handle}</div>
              )}
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100"
            >
              …
            </button>

            {menuOpen && (
              <div className="absolute end-0 bottom-full mb-2 w-44 rounded-2xl border bg-white shadow-lg overflow-hidden">
                {/* ملفي الشخصي -> /u/[username] */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    goPublicProfile();
                  }}
                  className="w-full text-start px-3 py-3 text-sm hover:bg-slate-50 text-slate-900 font-semibold"
                >
                  ملفي الشخصي
                </button>

                {/* لوحة التحكم */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/admin");
                  }}
                  className="w-full text-start px-4 py-3 text-sm hover:bg-slate-50 text-slate-900 font-semibold"
                >
                  لوحة التحكم
                </button>

                {/* ملفي الصحي */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/patient/profile");
                  }}
                  className="w-full text-start px-4 py-3 text-sm hover:bg-slate-50 text-slate-900 font-semibold"
                >
                  ملفي الصحي
                </button>

                {/* ✅ زر خاص بالطبيب في الانسدالة */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/doctor/clinic");
                  }}
                  className="w-full text-start px-4 py-3 text-sm hover:bg-slate-50 text-slate-900 font-semibold"
                >
                  عيادة الطبيب
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/settings");
                  }}
                  className="w-full text-start px-4 py-3 text-sm hover:bg-slate-50 text-slate-900 font-semibold"
                >
                  الإعدادات
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-start px-4 py-3 text-sm text-red-600 font-semibold hover:bg-slate-50"
                >
                  خروج
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ========================= Right Panel ========================= */
function RightPanelMock() {
  return (
    <div className="space-y-4">
      <div className="dr4x-card p-3 bg-white">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث"
            className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="dr4x-card p-4">
        <div className="font-semibold mb-2">ماذا تقدم DR4X؟</div>
        <p className="text-sm text-slate-600">
          منصة طبية مخصصة للاستشارات الطبية ومتابعة .
        </p>
      </div>

      <div className="dr4x-card p-4">
        <div className="font-semibold mb-2">أقسام شائعة</div>
        <ul className="text-sm text-slate-700 space-y-2">
          <li className="text-blue-600 cursor-pointer">استشارات نفسية</li>
          <li className="text-blue-600 cursor-pointer">أمراض الباطنة</li>
          <li className="text-blue-600 cursor-pointer">طب الأسرة</li>
          <li className="text-blue-600 cursor-pointer">جلدية وتجميل</li>
        </ul>
      </div>

      <HomeLibraryWidget />
    </div>
  );
}

/* ========================= Home Page ========================= */
export default function HomePage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <AppShell
      sidebar={<SidebarMock onOpenComposer={() => setComposerOpen(true)} />}
      header={
        <div className="relative w-full">
          {/* عنوان "لك" ثابت في مكانه */}
          <div className="pr-[100px] text-slate-900 font-extrabold text-2xl relative inline-block">
            لك
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-3 h-[4px] w-16 rounded-full bg-sky-500" />
          </div>

          {/* زر "متابعون" مع إزاحة مناسبة عن "لك" */}
          <div className="absolute top-1/2 -translate-y-1/2 right-[350px]">
            <button
              type="button"
              onClick={() => router.push("/following")}
              className="text-slate-600 font-bold text-xl hover:text-slate-900"
            >
              متابعون
            </button>
          </div>
        </div>
      }
      rightPanel={<RightPanelMock />}
    >
      <NewPostComposer
        onPosted={() => {
          setRefreshKey((k) => k + 1);
        }}
      />

      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPostCreated={() => {
          setComposerOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />

      <PostsFeed key={refreshKey} />
    </AppShell>
  );
}
