// src/app/u/[username]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Bell, Mail } from "lucide-react";

type PublicProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  is_doctor: boolean | null;
  created_at: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  show_following_list?: boolean | null;
  profile_center_path?: string | null; // ممكن يبقى في الجدول لكن لن نستخدمه الآن
};

type NotificationRowLite = {
  id: string;
  is_read: boolean;
};

const AVATAR_BUCKET = "avatars";
const COVER_BUCKET = "covers";
const SITE_ASSETS_BUCKET = "site_assets";
const PROFILE_CENTER_GIF_PATH = "profile-center/global.gif"; // ✅ صورة موحدة للجميع

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

async function signedUrl(bucket: string, path: string | null) {
  if (!path) return "";
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);
    if (error) {
      console.error("signedUrl error", bucket, path, error);
      return "";
    }
    const url = data?.signedUrl ?? "";
    return url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "";
  } catch (e) {
    console.error("signedUrl unexpected error", bucket, path, e);
    return "";
  }
}

export default function PublicUserPage() {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const rawUsername = (params?.username ?? "").toString();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [centerBannerUrl, setCenterBannerUrl] = useState(""); // ✅ GIF العام

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        // 🟢 مين أنا؟
        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const uid = uRes.user?.id ?? null;
        if (alive) setMeId(uid);

        // 🟢 اسم المستخدم من الرابط
        const u = decodeURIComponent(rawUsername || "").trim();
        if (!u) {
          if (!alive) return;
          setErr("اسم المستخدم غير صالح.");
          setLoading(false);
          return;
        }

        // 🟢 تحميل بيانات البروفايل
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id,username,full_name,email,is_doctor,created_at,avatar_path,cover_path,bio,city,country,show_following_list,profile_center_path"
          )
          .eq("username", u)
          .maybeSingle();

        if (error) throw error;
        if (!alive) return;

        const prof = (data ?? null) as PublicProfile | null;
        if (!prof) {
          setErr("المستخدم غير موجود أو لا يمكن عرضه.");
          setLoading(false);
          return;
        }

        setProfile(prof);

        // 🟢 تحميل روابط الصور (أفاتار + غلاف + GIF موحد من site_assets)
        const [a, c, center] = await Promise.all([
          signedUrl(AVATAR_BUCKET, prof.avatar_path),
          signedUrl(COVER_BUCKET, prof.cover_path),
          signedUrl(SITE_ASSETS_BUCKET, PROFILE_CENTER_GIF_PATH),
        ]);

        if (!alive) return;
        setAvatarUrl(a);
        setCoverUrl(c);
        setCenterBannerUrl(center); // نفس الصورة للجميع

        // 🟢 أعداد المتابعين / الذين يتابعهم
        const [
          { data: followersRows, error: followersErr },
          { data: followingRows, error: followingErr },
        ] = await Promise.all([
          supabase
            .from("followers")
            .select("follower_id")
            .eq("followed_id", prof.id),
          supabase
            .from("followers")
            .select("followed_id")
            .eq("follower_id", prof.id),
        ]);

        if (followersErr) console.error("followers count error", followersErr);
        if (followingErr) console.error("following count error", followingErr);
        if (!alive) return;

        setFollowersCount(followersRows?.length ?? 0);
        setFollowingCount(followingRows?.length ?? 0);

        // 🟢 هل أنا أتابعه؟
        if (uid && uid !== prof.id) {
          const { data: relRows, error: relErr } = await supabase
            .from("followers")
            .select("follower_id, followed_id")
            .eq("follower_id", uid)
            .eq("followed_id", prof.id);

          if (relErr) console.error("isFollowing error", relErr);
          if (!alive) return;
          setIsFollowing((relRows?.length ?? 0) > 0);
        } else {
          if (!alive) return;
          setIsFollowing(null);
        }

        // 🟢 شارات الرسائل والإشعارات
        if (uid) {
          try {
            const { data: dmCount, error: dmErr } = await supabase.rpc(
              "user_unread_dm_count"
            );
            if (dmErr) {
              console.error("user_unread_dm_count error", dmErr);
            } else if (alive) {
              const n =
                typeof dmCount === "number"
                  ? dmCount
                  : parseInt(String(dmCount ?? "0"), 10) || 0;
              setUnreadDmCount(n);
            }

            const { data: notifData, error: notifErr } = await supabase.rpc(
              "user_list_notifications",
              { p_limit: 50, p_offset: 0 }
            );
            if (notifErr) {
              console.error(
                "user_list_notifications error (badge)",
                notifErr
              );
            } else if (alive && Array.isArray(notifData)) {
              const rows = notifData as NotificationRowLite[];
              const unread = rows.filter(
                (r) => r && r.is_read === false
              ).length;
              setUnreadNotifCount(unread);
            }
          } catch (extraErr) {
            console.error("unread counters load error", extraErr);
          }
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error("Public profile load error", e);
        setErr(e?.message ?? "تعذر تحميل الملف العام.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [rawUsername]);

  const isOwner = useMemo(() => {
    if (!meId || !profile) return false;
    return meId === profile.id;
  }, [meId, profile]);

  const displayName = useMemo(() => {
    const full = (profile?.full_name ?? "").trim();
    const user = (profile?.username ?? "").trim();
    const mail = (profile?.email ?? "").split("@")[0] ?? "";
    return full || (user ? user : mail || "مستخدم");
  }, [profile]);

  const handleName = useMemo(() => {
    const user = (profile?.username ?? "").trim();
    if (user) return user;
    const em = (profile?.email ?? "").trim();
    return em ? em.split("@")[0] : "";
  }, [profile]);

  const initials = useMemo(() => {
    const s = displayName.trim();
    return ((s[0] ?? "D") + (s[1] ?? "R")).toUpperCase();
  }, [displayName]);

  const cityCountry = useMemo(() => {
    const city = (profile?.city ?? "").trim();
    const country = (profile?.country ?? "").trim();
    if (!city && !country) return "";
    if (city && country) return `${city}، ${country}`;
    return city || country;
  }, [profile]);

  async function handleToggleFollow() {
    if (!profile || !meId || followBusy) return;
    if (meId === profile.id) return;

    setFollowBusy(true);
    setErr("");

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_id", meId)
          .eq("followed_id", profile.id);

        if (error) throw error;
        setIsFollowing(false);
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        const { error } = await supabase
          .from("followers")
          .insert({ follower_id: meId, followed_id: profile.id });

        if (error) {
          const msg = error.message || "";
          if (
            error.code === "23505" ||
            msg.includes("duplicate key value") ||
            msg.includes("followers_pkey")
          ) {
            setIsFollowing(true);
            return;
          }
          throw error;
        }

        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
      }
    } catch (e: any) {
      console.error("toggle follow error", e);
      setErr(e?.message ?? "تعذر تحديث حالة المتابعة.");
    } finally {
      setFollowBusy(false);
    }
  }

  async function handleMessageClick() {
    try {
      if (!profile) return;

      const { data: sData, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;

      const uid = sData?.session?.user?.id ?? null;
      if (!uid) {
        router.push("/auth/login");
        return;
      }

      if (uid === profile.id) {
        return;
      }

      const { data, error } = await supabase.rpc(
        "start_or_get_dm_conversation",
        {
          p_other_user_id: profile.id,
        }
      );

      if (error) {
        console.error("start_or_get_dm_conversation error", error);
        alert(
          `تعذر فتح المحادثة:\n${error.message || "خطأ من قاعدة البيانات."}`
        );
        return;
      }

      let convId: string | null = null;

      if (!data) {
        convId = null;
      } else if (typeof data === "string") {
        convId = data;
      } else if (Array.isArray(data)) {
        const first: any = data[0] ?? {};
        convId = first.id || first.conversation_id || first.conv_id || null;
      } else if (typeof data === "object") {
        const obj: any = data;
        convId = obj.id || obj.conversation_id || obj.conv_id || null;
      }

      if (!convId) {
        alert(
          "تم تنفيذ الدالة لكن لم نستطع قراءة رقم المحادثة من الرد.\n" +
            "تأكد أن دالة start_or_get_dm_conversation في Supabase ترجع uuid باسم id."
        );
        return;
      }

      setUnreadDmCount(0);
      router.push(`/messages/${convId}`);
    } catch (e: any) {
      console.error("handleMessageClick unexpected error", e);
      alert(
        `حدث خطأ غير متوقع أثناء فتح المحادثة:\n${
          e?.message || "حاول مرة أخرى لاحقًا."
        }`
      );
    }
  }

  function handleNotificationsClick() {
    setUnreadNotifCount(0);
    router.push("/notifications");
  }

  // ✅ يسمح بزر العيادة فقط لصاحب البروفايل إذا كان طبيبًا
  const canShowClinicButton = useMemo(() => {
    return !!profile?.is_doctor && isOwner;
  }, [profile, isOwner]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm">جاري تحميل البروفايل…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* الهيدر العلوي */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full px-4 py-2 bg-slate-900 text-slate-100 border border-slate-700 hover:bg-slate-800 text-sm"
          >
            الرجوع
          </button>

          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex items-center gap-2 rounded-full px-4 py-2 bg-slate-900 border border-emerald-500/60 hover:bg-slate-950 text-xs sm:text-sm font-semibold"
          >
            <span className="h-8 w-8 rounded-full bg-emerald-500 text-slate-900 grid place-items-center text-xs font-extrabold">
              DR
            </span>
            <span>DR4X</span>
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-500 bg-red-900/40 p-4 text-sm text-red-50 whitespace-pre-wrap">
            {err}
          </div>
        ) : null}

        {!profile ? null : (
          <>
            {/* بطاقة البروفايل الرئيسية */}
            <div className="rounded-[32px] border border-emerald-500/40 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950/90 shadow-[0_0_40px_rgba(16,185,129,0.25)] overflow-hidden">
              {/* الغلاف */}
              <div className="relative h-[220px] bg-slate-900">
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt="cover"
                    className="h-full w-full object-cover"
                  />
                ) : null}

                {/* الصورة الشخصية */}
                <div className="absolute -bottom-16 right-10">
                  <div className="h-24 w-24 rounded-full bg-emerald-500 text-slate-900 grid place-items-center text-2xl font-extrabold ring-4 ring-slate-950 overflow-hidden shadow-[0_0_25px_rgba(16,185,129,0.8)]">
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
                </div>
              </div>

              {/* المحتوى تحت الغلاف */}
              <div className="pt-20 pb-6 px-6 sm:px-8">
                {/* ✅ الصورة الوسطى المشتركة من لوحة التحكم */}
                {centerBannerUrl && (
                  <div className="mb-6 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={centerBannerUrl}
                      alt="profile center banner"
                      className="max-h-24 rounded-2xl border border-emerald-500/40 bg-slate-900 object-contain"
                    />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* بيانات العضو */}
                  <div className="space-y-1">
                    <div className="text-xl sm:text-2xl font-extrabold">
                      {v(profile.full_name) === "—"
                        ? displayName
                        : v(profile.full_name)}
                    </div>
                    <div className="text-sm text-emerald-400">
                      {handleName ? `@${handleName}` : ""}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {profile.is_doctor ? "طبيب" : "مريض"} • عضو منذ{" "}
                      {fmtDateTime(profile.created_at)}
                    </div>

                    {cityCountry && (
                      <div className="text-xs text-emerald-300 mt-1">
                        {cityCountry}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300">
                      <span>
                        المتابعون:{" "}
                        <span className="font-semibold text-emerald-400">
                          {followersCount}
                        </span>
                      </span>
                      <span>
                        الذين يتابعهم:{" "}
                        <span className="font-semibold text-emerald-400">
                          {followingCount}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* أزرار التفاعل */}
                  {!isOwner && meId ? (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={handleNotificationsClick}
                        className="relative h-9 w-9 rounded-full border border-slate-600 bg-slate-900 hover:bg-slate-800 flex items-center justify-center"
                      >
                        <Bell className="h-4 w-4" />
                        {unreadNotifCount > 0 && (
                          <span className="absolute -top-1 -left-1 min-w-[18px] px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950 flex items-center justify-center">
                            {unreadNotifCount > 99
                              ? "99+"
                              : unreadNotifCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleMessageClick}
                        className="relative h-9 w-9 rounded-full border border-slate-600 bg-slate-900 hover:bg-slate-800 flex items-center justify-center"
                      >
                        <Mail className="h-4 w-4" />
                        {unreadDmCount > 0 && (
                          <span className="absolute -top-1 -left-1 min-w-[18px] px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950 flex items-center justify-center">
                            {unreadDmCount > 99 ? "99+" : unreadDmCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={followBusy}
                        onClick={handleToggleFollow}
                        className={[
                          "rounded-2xl px-4 sm:px-5 py-2 text-sm font-semibold border",
                          isFollowing
                            ? "bg-transparent border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                            : "bg-emerald-500 border-emerald-500 text-slate-900 hover:bg-emerald-400",
                          followBusy ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        {followBusy
                          ? "جارٍ التحديث…"
                          : isFollowing
                          ? "إلغاء المتابعة"
                          : "متابعة"}
                      </button>
                    </div>
                  ) : null}

                  {isOwner ? (
                    <div className="flex items-center justify-end mt-2 sm:mt-0">
                      <button
                        type="button"
                        onClick={() => router.push("/profile")}
                        className="rounded-2xl px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold border border-emerald-500"
                      >
                        تعديل الملف الشخصي
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* ✅ زر دخول العيادة (يظهر للطبيب صاحب الحساب فقط) */}
                {canShowClinicButton && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => router.push("/doctor/clinic")}
                      className="rounded-full px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-extrabold border border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.7)]"
                    >
                      دخول العيادة (البث المباشر)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* نبذة عني */}
            <div className="rounded-[32px] border border-slate-800 bg-slate-950/80 px-6 py-5 mt-4">
              <div className="text-base sm:text-lg font-semibold">
                نبذة عني
              </div>
              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {v(profile.bio ?? null) === "—"
                  ? "لم يقم هذا المستخدم بكتابة نبذة حتى الآن."
                  : v(profile.bio ?? null)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
