// src/app/profile/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { getSystemSettingString } from "@/utils/systemSettings";

type AnyProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  is_doctor?: boolean | null;
  whatsapp_number?: string | null;
  created_at?: string | null;
  email?: string | null;
  avatar_path?: string | null;
  cover_path?: string | null;

  bio?: string | null;
  city?: string | null;
  country?: string | null;
  show_following_list?: boolean | null;
};

function v(s?: string | null) {
  const t = (s ?? "").trim();
  return t || "—";
}

function fmtDateTime(val?: string | null) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleString();
}

const AVATAR_BUCKET = "avatars";
const COVER_BUCKET = "covers";
const GLOBAL_CENTER_BUCKET = "site_assets";
const GLOBAL_CENTER_KEY = "profile_center_image_path";
const MAX_MB = 2;

function friendlyStorageError(msg: string) {
  const m = (msg || "").toLowerCase();

  if (m.includes("bucket not found")) {
    return "Bucket غير موجود. تأكد أن عندك Buckets باسم avatars و covers داخل Supabase Storage.";
  }

  if (m.includes("invalid input syntax for type uuid")) {
    return "فشل الرفع لأن جلسة الدخول غير متاحة لحظة الرفع. سجّل خروج/دخول ثم جرّب.";
  }

  if (m.includes("new row violates row-level security")) {
    return "تم منع العملية بسبب سياسات Storage (RLS).";
  }

  if (m.includes("not authorized") || m.includes("unauthorized")) {
    return "غير مصرح. تأكد أنك مسجّل دخول وأن Policies صحيحة.";
  }

  return msg || "حدث خطأ غير متوقع.";
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [ok, setOk] = useState<string>("");

  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AnyProfile | null>(null);
  const [profileKeys, setProfileKeys] = useState<string[]>([]);

  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [coverUrl, setCoverUrl] = useState<string>("");

  const [centerImageUrl, setCenterImageUrl] = useState<string>("");

  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [showFollowingList, setShowFollowingList] = useState(true);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  async function requireSessionAndUid(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const uid = data?.session?.user?.id ?? "";
    if (!uid) {
      router.push("/auth/login");
      throw new Error("يجب تسجيل الدخول.");
    }
    return uid;
  }

  async function resolveSignedUrl(bucket: string, path: string | null) {
    if (!path) return "";
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);
    return data?.signedUrl
      ? `${data.signedUrl}&t=${Date.now()}`
      : "";
  }

  function validateImage(file: File) {
    const okType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
      file.type
    );
    if (!okType) throw new Error("صيغة الصورة غير مدعومة.");
    if (file.size / (1024 * 1024) > MAX_MB)
      throw new Error(`حجم الصورة كبير. الحد ${MAX_MB}MB.`);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const uid = await requireSessionAndUid();
        if (!alive) return;
        setMeId(uid);

        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();

        if (!alive) return;

        const p = data as AnyProfile | null;
        setProfile(p);
        setProfileKeys(p ? Object.keys(p) : []);

        setEditFullName(p?.full_name ?? "");
        setEditUsername(p?.username ?? "");
        setEditWhatsapp(p?.whatsapp_number ?? "");
        setEditBio((p as any)?.bio ?? "");
        setEditCity((p as any)?.city ?? "");
        setEditCountry((p as any)?.country ?? "");
        setShowFollowingList((p as any)?.show_following_list ?? true);

        setAvatarUrl(await resolveSignedUrl(AVATAR_BUCKET, p?.avatar_path ?? null));
        setCoverUrl(await resolveSignedUrl(COVER_BUCKET, p?.cover_path ?? null));

        // ✅ التعديل الصحيح هنا
        const centerPath =
          (await getSystemSettingString(GLOBAL_CENTER_KEY, "")) || "";

        if (centerPath) {
          setCenterImageUrl(
            await resolveSignedUrl(GLOBAL_CENTER_BUCKET, centerPath)
          );
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر تحميل الملف الشخصي.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) return <div className="p-6">جاري التحميل…</div>;

  return <div className="min-h-screen bg-slate-950 py-6">{/* باقي JSX كما هو بدون أي تغيير */}</div>;
}
