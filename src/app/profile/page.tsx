// src/app/profile/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  getSystemSettingString,
} from "@/utils/systemSettings";

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

  // حقول اختيارية إذا كانت موجودة في الجدول (لا ننشئ أعمدة جديدة)
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
const GLOBAL_CENTER_BUCKET = "site_assets"; // ✅ باكيت الصورة العامة
const GLOBAL_CENTER_KEY = "profile_center_image_path"; // ✅ مفتاح الإعداد
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
    return "تم منع العملية بسبب سياسات Storage (RLS). تأكد أن المسار يبدأ بـ UID/ وأن Policies (INSERT/UPDATE/SELECT) موجودة للـ bucket.";
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

  // ✅ جديد: صورة مركزية عامة من لوحة المدير
  const [centerImageUrl, setCenterImageUrl] = useState<string>("");

  // حقول قابلة للتعديل
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [showFollowingList, setShowFollowingList] = useState(true);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ تأكيد session (JWT) قبل الرفع/الحفظ
  async function requireSessionAndUid(): Promise<string> {
    const { data: sData, error: sErr } = await supabase.auth.getSession();
    if (sErr) throw sErr;

    const session = sData?.session;
    const uid = session?.user?.id ?? "";

    if (!uid) {
      router.push("/auth/login");
      throw new Error("يجب تسجيل الدخول.");
    }
    return uid;
  }

  // ✅ Signed URL (حتى لو bucket Private)
  async function resolveSignedUrl(
    bucket: string,
    path: string | null
  ): Promise<string> {
    if (!path) return "";
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);
    if (error) return "";
    const url = data?.signedUrl ?? "";
    return url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "";
  }

  function validateImage(file: File) {
    const okType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
      file.type
    );
    if (!okType)
      throw new Error(
        "صيغة الصورة غير مدعومة. استخدم JPG/PNG/WebP/GIF."
      );
    const mb = file.size / (1024 * 1024);
    if (mb > MAX_MB)
      throw new Error(`حجم الصورة كبير. الحد الأقصى ${MAX_MB}MB.`);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setOk("");
        setLoading(true);

        const uid = await requireSessionAndUid();
        if (!alive) return;
        setMeId(uid);

        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();

        if (pErr) throw pErr;

        if (!alive) return;

        const p = (pData ?? null) as AnyProfile | null;
        setProfile(p);
        setProfileKeys(p ? Object.keys(p) : []);

        setEditFullName((p?.full_name ?? "").toString());
        setEditUsername((p?.username ?? "").toString());
        setEditWhatsapp((p?.whatsapp_number ?? "").toString());
        setEditBio(((p as any)?.bio ?? "").toString());
        setEditCity(((p as any)?.city ?? "").toString());
        setEditCountry(((p as any)?.country ?? "").toString());
        setShowFollowingList(
          ((p as any)?.show_following_list ?? true) as boolean
        );

        const nextAvatar = await resolveSignedUrl(
          AVATAR_BUCKET,
          p?.avatar_path ?? null
        );
        const nextCover = await resolveSignedUrl(
          COVER_BUCKET,
          p?.cover_path ?? null
        );

        // ✅ تحميل مسار الصورة العامة من إعدادات المدير
        const centerPath =
          (await getSystemSettingString(
            supabase,
            GLOBAL_CENTER_KEY,
            ""
          )) || "";
        let nextCenter = "";
        if (centerPath) {
          nextCenter = await resolveSignedUrl(
            GLOBAL_CENTER_BUCKET,
            centerPath
          );
        }

        if (!alive) return;
        setAvatarUrl(nextAvatar);
        setCoverUrl(nextCover);
        setCenterImageUrl(nextCenter);

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر تحميل بيانات الملف الشخصي.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const displayName = useMemo(() => {
    const full = (profile?.full_name ?? "").trim();
    const user = (profile?.username ?? "").trim();
    const mail = (profile?.email ?? "").split("@")[0] ?? "";
    return full || (user ? `@${user}` : mail || "مستخدم");
  }, [profile]);

  const handle = useMemo(() => {
    const user = (profile?.username ?? "").trim();
    if (user) return user;
    const em = (profile?.email ?? "").trim();
    return em ? em.split("@")[0] : "";
  }, [profile]);

  const initials = useMemo(() => {
    const s = displayName.trim();
    return ((s[0] ?? "D") + (s[1] ?? "R")).toUpperCase();
  }, [displayName]);

  const hasBioField = useMemo(
    () => profileKeys.includes("bio"),
    [profileKeys]
  );
  const hasCityField = useMemo(
    () => profileKeys.includes("city"),
    [profileKeys]
  );
  const hasCountryField = useMemo(
    () => profileKeys.includes("country"),
    [profileKeys]
  );
  const hasShowFollowingField = useMemo(
    () => profileKeys.includes("show_following_list"),
    [profileKeys]
  );

  async function uploadCover(file: File) {
    validateImage(file);

    const uid = await requireSessionAndUid();
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
        ? "gif"
        : "jpg";

    const path = `${uid}/cover.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(COVER_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
    if (upErr) throw new Error(friendlyStorageError(upErr.message));

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ cover_path: path })
      .eq("id", uid);
    if (dbErr) throw dbErr;

    setProfile((p) => (p ? { ...p, cover_path: path } : p));
    setCoverUrl(await resolveSignedUrl(COVER_BUCKET, path));
  }

  async function uploadAvatar(file: File) {
    validateImage(file);

    const uid = await requireSessionAndUid();
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
        ? "gif"
        : "jpg";

    const path = `${uid}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
    if (upErr) throw new Error(friendlyStorageError(upErr.message));

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", uid);
    if (dbErr) throw dbErr;

    setProfile((p) => (p ? { ...p, avatar_path: path } : p));
    setAvatarUrl(await resolveSignedUrl(AVATAR_BUCKET, path));
  }

  async function saveEdit() {
    const uid = await requireSessionAndUid();

    const full_name = editFullName.trim() || null;
    const username = editUsername.trim() || null;
    const whatsapp_number = editWhatsapp.trim() || null;

    const updatePayload: Record<string, any> = {
      full_name,
      username,
      whatsapp_number,
    };

    if (hasBioField) {
      updatePayload.bio = editBio.trim() || null;
    }
    if (hasCityField) {
      updatePayload.city = editCity.trim() || null;
    }
    if (hasCountryField) {
      updatePayload.country = editCountry.trim() || null;
    }
    if (hasShowFollowingField) {
      updatePayload.show_following_list = showFollowingList;
    }

    setBusy(true);
    setErr("");
    setOk("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", uid);
      if (error) throw error;

      setProfile((p) =>
        p
          ? {
              ...p,
              full_name,
              username,
              whatsapp_number,
              ...(hasBioField ? { bio: updatePayload.bio } : {}),
              ...(hasCityField ? { city: updatePayload.city } : {}),
              ...(hasCountryField ? { country: updatePayload.country } : {}),
              ...(hasShowFollowingField
                ? { show_following_list: showFollowingList }
                : {}),
            }
          : p
      );

      setOk("تم حفظ التعديلات بنجاح.");
    } catch (e: any) {
      setErr(e?.message ?? "فشل حفظ التعديل.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6">جاري التحميل…</div>;

  return (
    <div className="min-h-screen bg-slate-950 py-6">
      <div className="max-w-4xl mx-auto p-6 space-y-6 bg-slate-950 text-slate-100 rounded-3xl border border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
        {/* الهيدر */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-emerald-400">
              الملف الشخصي
            </h1>
            <div className="text-sm text-emerald-300/70 mt-1">
              {handle ? `@${handle}` : ""}
            </div>
          </div>

          <button
            onClick={() => router.back()}
            className="rounded-xl px-4 py-2 border border-emerald-500/60 bg-slate-900 hover:bg-slate-900/80 text-sm"
          >
            الرجوع
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-500 bg-red-900/40 p-4 text-sm text-red-50 whitespace-pre-wrap">
            {err}
          </div>
        ) : null}

        {ok ? (
          <div className="rounded-2xl border border-emerald-500 bg-emerald-900/30 p-4 text-sm text-emerald-50 whitespace-pre-wrap">
            {ok}
          </div>
        ) : null}

        {/* الغلاف + الصورة + رفع الصور */}
        <div className="rounded-[32px] border border-emerald-500/40 overflow-hidden bg-slate-900">
          <div className="relative h-[180px] bg-slate-800">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt="cover"
                className="h-full w-full object-cover"
              />
            ) : null}

            <div className="absolute top-4 left-4 flex gap-2">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="rounded-full px-4 py-2 bg-slate-950/80 border border-emerald-500/70 hover:bg-slate-950 text-xs sm:text-sm font-semibold"
                disabled={busy}
              >
                تغيير الغلاف
              </button>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;

                  try {
                    setBusy(true);
                    setErr("");
                    setOk("");
                    await uploadCover(f);
                    setOk("تم تحديث صورة الغلاف.");
                  } catch (x: any) {
                    setErr(x?.message ?? "فشل رفع الغلاف.");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </div>

            <div className="absolute -bottom-10 right-6">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-slate-950 text-white grid place-items-center text-lg font-bold ring-4 ring-emerald-500/70 overflow-hidden shadow-[0_0_25px_rgba(16,185,129,0.8)]">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-2 right-1/2 translate-x-1/2 rounded-full px-3 py-1 bg-slate-900 border border-emerald-500 text-[11px] hover:bg-slate-950"
                  disabled={busy}
                >
                  رفع
                </button>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;

                    try {
                      setBusy(true);
                      setErr("");
                      setOk("");
                      await uploadAvatar(f);
                      setOk("تم تحديث الصورة الشخصية.");
                    } catch (x: any) {
                      setErr(x?.message ?? "فشل رفع الصورة الشخصية.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-14 px-6 pb-5">
            <div className="text-xl font-extrabold text-emerald-50">
              {v(profile?.full_name ?? null) === "—"
                ? displayName
                : v(profile?.full_name ?? null)}
            </div>
            <div className="text-sm text-emerald-300 mt-1">
              {handle ? `@${handle}` : ""}
            </div>
            <div className="text-xs text-emerald-500/70 mt-3">
              {profile?.is_doctor ? "طبيب" : "مريض"} • عضو منذ{" "}
              {fmtDateTime(profile?.created_at ?? null)}
            </div>
          </div>

          {/* ✅ هنا الصورة العامة من لوحة المدير – في منتصف الكارت */}
          {centerImageUrl ? (
            <div className="px-6 pb-6">
              <div className="mt-2 flex justify-center">
                <div className="rounded-[28px] border border-emerald-500/50 bg-slate-950/80 px-4 py-3 shadow-[0_0_30px_rgba(16,185,129,0.35)] max-w-xl w-full flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={centerImageUrl}
                    alt="PROFILE_CENTER"
                    className="max-h-40 object-contain"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* بيانات حساسة (قراءة فقط) */}
        <div className="rounded-3xl border border-emerald-500/40 bg-slate-950 p-6 space-y-4">
          <div className="text-lg font-semibold text-emerald-300">
            بيانات الحساب (خاصة)
          </div>
          <div className="text-xs text-slate-400">
            البريد وواتساب ومعرّف المستخدم لا تظهر في صفحة البروفايل العامة، فقط
            لك أنت.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl border border-slate-700 p-3">
              <div className="text-xs text-slate-400">البريد</div>
              <div className="font-semibold">{v(profile?.email ?? null)}</div>
            </div>

            <div className="rounded-2xl border border-slate-700 p-3">
              <div className="text-xs text-slate-400">واتساب</div>
              <div className="font-semibold">
                {v(profile?.whatsapp_number ?? null)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 p-3 sm:col-span-2">
              <div className="text-xs text-slate-400">معرّف المستخدم</div>
              <div className="font-mono text-xs break-all">{meId ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* نموذج التعديل – في نفس الصفحة */}
        <div className="rounded-3xl border border-emerald-500/40 bg-slate-950 p-6 space-y-4">
          <div className="text-lg font-semibold text-emerald-300">
            تعديل الملف
          </div>
          <div className="text-xs text-slate-400">
            هذه الحقول هي التي تستخدم لتجربة المستخدم ولصفحة البروفايل العامة{" "}
            <span className="font-mono text-[11px]">/u/[username]</span> (الاسم،
            النبذة، المدينة). لا نعرض أي بيانات طبية أو حساسة للعامة.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">الاسم الكامل</div>
              <input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">اسم المستخدم</div>
              <input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">واتساب (خاص)</div>
              <input
                value={editWhatsapp}
                onChange={(e) => setEditWhatsapp(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">الدولة</div>
              <input
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none"
                placeholder="مثال: السعودية"
              />
              {!hasCountryField ? (
                <div className="mt-1 text-[11px] text-red-400">
                  * لحفظ الدولة تحتاج عمود{" "}
                  <span className="font-mono">country</span> في جدول{" "}
                  <span className="font-mono">profiles</span>.
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400 mb-1">
              المدينة (تظهر مع البروفايل العام)
            </div>
            <input
              value={editCity}
              onChange={(e) => setEditCity(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none"
              placeholder="مثال: جدة"
            />
            {!hasCityField ? (
              <div className="mt-1 text-[11px] text-red-400">
                * لحفظ المدينة تحتاج عمود{" "}
                <span className="font-mono">city</span> في جدول{" "}
                <span className="font-mono">profiles</span>.
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-xs text-slate-400 mb-1">
              النبذة العامة (تظهر في صفحة البروفايل للناس)
            </div>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none resize-none"
              placeholder="اكتب تعريفًا بسيطًا عن نفسك، مدينتك، اهتماماتك العامة…"
            />
            {!hasBioField ? (
              <div className="mt-1 text-[11px] text-red-400">
                * لحفظ هذه النبذة تحتاج عمود{" "}
                <span className="font-mono">bio</span> في جدول{" "}
                <span className="font-mono">profiles</span>.
              </div>
            ) : null}
          </div>

          {/* إعداد الخصوصية لقائمة الذين أتابعهم */}
          <div className="mt-2 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-100">
                إظهار قائمة الحسابات التي أتابعها
              </div>
              <div className="text-xs text-slate-400 mt-1">
                إذا أغلقت هذا الخيار، لن يستطيع الآخرون رؤية قائمة الحسابات التي
                تتابعها (لكن ما زال يمكن إظهار العدد فقط حسب ما تقرره لاحقًا).
              </div>
              {!hasShowFollowingField ? (
                <div className="mt-1 text-[11px] text-red-400">
                  * لحفظ هذا الإعداد تحتاج عمود{" "}
                  <span className="font-mono">show_following_list</span> في
                  جدول <span className="font-mono">profiles</span>.
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setShowFollowingList((v) => !v)}
              className={[
                "relative inline-flex h-7 w-12 items-center rounded-full transition",
                showFollowingList ? "bg-emerald-500" : "bg-slate-600",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-5 w-5 transform rounded-full bg-slate-950 transition",
                  showFollowingList ? "translate-x-5" : "translate-x-1",
                ].join(" ")}
              />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={saveEdit}
              className="rounded-2xl px-6 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-900 text-sm font-semibold disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "جارٍ الحفظ…" : "حفظ التعديلات"}
            </button>
          </div>

          <div className="text-xs text-slate-500">
            * i18n: استبدل النصوص بمفاتيح الترجمة حسب نظام تعدد اللغات عندك.
          </div>
        </div>
      </div>
    </div>
  );
}
