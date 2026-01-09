// src/components/layout/ProfileMenu.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

const AVATAR_BUCKET = "avatars";

type ProfileLite = {
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null; // رابط نهائي (Signed URL)
};

export default function ProfileMenu({ className = "" }: { className?: string }) {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // ✅ تحويل avatar_path إلى Signed URL (يشتغل حتى لو bucket private)
  async function resolveAvatarUrl(path: string | null): Promise<string | null> {
    if (!path) return null;

    // Signed URL لمدة ساعة + كاش باسسر عشان يتحدث بسرعة بعد الرفع
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(path, 60 * 60);

    if (error) return null;

    const url = data?.signedUrl ?? null;
    if (!url) return null;

    return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  }

  // تحميل بيانات المستخدم
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingProfile(true);

        const {
          data: { user },
          error: uErr,
        } = await supabase.auth.getUser();

        if (!alive) return;

        if (uErr) {
          console.error("ProfileMenu auth.getUser error", uErr);
        }

        if (!user) {
          setProfile(null);
          setLoadingProfile(false);
          return;
        }

        // ✅ نقرأ فقط الأعمدة الموجودة فعلاً: avatar_path (بدون avatar_url)
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, username, avatar_path")
          .eq("id", user.id)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.error("ProfileMenu profiles error", error);
        }

        const finalAvatarUrl = await resolveAvatarUrl(
          (data as any)?.avatar_path ?? null
        );

        if (!alive) return;

        setProfile({
          full_name: (data as any)?.full_name ?? null,
          username: (data as any)?.username ?? null,
          email: user.email ?? null,
          avatar_url: finalAvatarUrl,
        });
      } catch (e) {
        console.error("ProfileMenu load profile error", e);
      } finally {
        if (alive) setLoadingProfile(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // إغلاق المنيو عند الضغط خارجها أو زر Esc
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
    <div
      className={["relative", className].filter(Boolean).join(" ")}
      ref={profileMenuRef}
    >
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
            unoptimized
            // احتياط لو فيه مشكلة دومين الصور
            onError={() => {
              // لا نكسر الصفحة
            }}
          />
        ) : (
          initials
        )}
      </button>

      {profileMenuOpen && (
        <div className="absolute end-0 mt-2 w-44 rounded-2xl border bg-white shadow-lg overflow-hidden text-sm">
          {/* رأس القائمة */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="font-semibold truncate">
              {loadingProfile ? "..." : displayName}
            </div>
            {handleName && !loadingProfile ? (
              <div className="text-xs text-slate-500 truncate">@{handleName}</div>
            ) : null}
          </div>

          {/* العناصر المشتركة */}
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

          {/* زر "خاص للطبيب" */}
          <button
            type="button"
            onClick={() => {
              setProfileMenuOpen(false);
              router.push("/doctor");
            }}
            className="w-full text-start px-4 py-2 hover:bg-slate-50"
          >
            خاص للطبيب
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
  );
}
