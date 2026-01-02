"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { UserPlus, UserCheck } from "lucide-react";

type PublicProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  is_doctor: boolean | null;
  avatar_path: string | null;
  cover_path: string | null;
};

type TabKey = "posts" | "replies" | "media" | "likes";

function safeText(x: any) {
  return typeof x === "string" ? x : "";
}

function initialsFrom(name: string) {
  const s = (name || "").trim();
  if (!s) return "؟";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "؟";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function getPublicUrl(bucket: string, path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

function getLang(): "ar" | "en" | "tr" {
  if (typeof document === "undefined") return "ar";
  const l = (document.documentElement.lang || "ar").toLowerCase();
  if (l.startsWith("tr")) return "tr";
  if (l.startsWith("en")) return "en";
  return "ar";
}

function tDict(lang: "ar" | "en" | "tr") {
  const ar = {
    edit: "تعديل الملف الشخصي",
    follow: "متابعة",
    following: "متابَع",
    followers: "متابعون",
    followingLbl: "المتابَعون",
    posts: "المنشورات",
    replies: "الردود",
    media: "الوسائط",
    likes: "الإعجابات",
    notFound: "المستخدم غير موجود أو لا يمكن عرضه.",
    back: "رجوع",
    patient: "مريض",
    doctor: "طبيب",
    loading: "جاري التحميل...",
  };
  const en = {
    edit: "Edit profile",
    follow: "Follow",
    following: "Following",
    followers: "Followers",
    followingLbl: "Following",
    posts: "Posts",
    replies: "Replies",
    media: "Media",
    likes: "Likes",
    notFound: "User not found or cannot be displayed.",
    back: "Back",
    patient: "Patient",
    doctor: "Doctor",
    loading: "Loading...",
  };
  const tr = {
    edit: "Profili düzenle",
    follow: "Takip et",
    following: "Takip ediliyor",
    followers: "Takipçiler",
    followingLbl: "Takip edilen",
    posts: "Gönderiler",
    replies: "Yanıtlar",
    media: "Medya",
    likes: "Beğeniler",
    notFound: "Kullanıcı bulunamadı veya gösterilemiyor.",
    back: "Geri",
    patient: "Hasta",
    doctor: "Doktor",
    loading: "Yükleniyor...",
  };
  return lang === "tr" ? tr : lang === "en" ? en : ar;
}

function normalizeUsername(raw: string) {
  const s = safeText(raw);
  try {
    return decodeURIComponent(s).trim().toLowerCase();
  } catch {
    return s.trim().toLowerCase();
  }
}

export default function PublicUserProfileClientXRTL({ username }: { username: string }) {
  const router = useRouter();

  const [lang, setLang] = useState<"ar" | "en" | "tr">("ar");
  const ui = useMemo(() => tDict(lang), [lang]);

  const [meId, setMeId] = useState<string | null>(null);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState<string | null>(null);

  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [tab, setTab] = useState<TabKey>("posts");

  // Lists (خفيفة للتجربة)
  const [posts, setPosts] = useState<any[]>([]);
  const [replies, setReplies] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [likes, setLikes] = useState<any[]>([]);

  const cleanUsername = useMemo(() => normalizeUsername(username), [username]);

  const isOwn = useMemo(() => !!meId && !!profile?.id && meId === profile.id, [meId, profile?.id]);

  const avatarUrl = useMemo(() => getPublicUrl("clinic", profile?.avatar_path ?? null), [profile?.avatar_path]);
  const coverUrl = useMemo(() => getPublicUrl("clinic", profile?.cover_path ?? null), [profile?.cover_path]);

  const displayName = useMemo(() => {
    const n = safeText(profile?.full_name);
    if (n) return n;
    const u = safeText(profile?.username);
    if (u) return u;
    const e = safeText(profile?.email);
    return e || "—";
  }, [profile]);

  const handle = useMemo(() => {
    const u = safeText(profile?.username);
    if (!u) return "";
    return `@${u}`;
  }, [profile]);

  const roleLabel = useMemo(() => {
    if (!profile) return null;
    return profile.is_doctor ? ui.doctor : ui.patient;
  }, [profile, ui.doctor, ui.patient]);

  async function loadMe() {
    const { data } = await supabase.auth.getUser();
    setMeId(data?.user?.id ?? null);
    return data?.user?.id ?? null;
  }

  async function loadProfileByUsername(u: string) {
    setLoading(true);
    setNotFound(null);

    // ✅ Debug بسيط (ما يأثر على الشكل)
    console.log("[/u] param username raw=", username, "normalized=", u);

    // ✅ ilike (غير حساس لحالة الحروف) + limit 1
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, email, is_doctor, avatar_path, cover_path")
      .ilike("username", u)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log("[/u] profiles query error:", error);
      setProfile(null);
      setNotFound(`${ui.notFound}\n${error.message}`);
      setLoading(false);
      return null;
    }

    if (!data) {
      console.log("[/u] No row found for username:", u);
      setProfile(null);
      setNotFound(ui.notFound);
      setLoading(false);
      return null;
    }

    const p = data as PublicProfile;
    setProfile(p);
    setLoading(false);
    return p;
  }

  async function loadCounts(userId: string) {
    const followersRes = await supabase
      .from("followers")
      .select("follower_id", { count: "exact", head: true })
      .eq("followed_id", userId);

    if (!followersRes.error) setFollowersCount(followersRes.count ?? 0);

    const followingRes = await supabase
      .from("followers")
      .select("followed_id", { count: "exact", head: true })
      .eq("follower_id", userId);

    if (!followingRes.error) setFollowingCount(followingRes.count ?? 0);
  }

  async function loadFollowState(me: string, target: string) {
    const { data, error } = await supabase
      .from("followers")
      .select("follower_id, followed_id")
      .eq("follower_id", me)
      .eq("followed_id", target)
      .maybeSingle();

    if (error) {
      setIsFollowing(false);
      return;
    }
    setIsFollowing(!!data);
  }

  async function loadTabData(targetId: string, key: TabKey) {
    if (key === "posts") {
      const { data } = await supabase
        .from("posts")
        .select("id, content, created_at, image_paths, video_urls")
        .eq("author_id", targetId)
        .order("created_at", { ascending: false })
        .limit(50);
      setPosts(data ?? []);
      return;
    }

    if (key === "replies") {
      const { data } = await supabase
        .from("replies")
        .select("id, post_id, content, created_at")
        .eq("user_id", targetId)
        .order("created_at", { ascending: false })
        .limit(50);
      setReplies(data ?? []);
      return;
    }

    if (key === "media") {
      const { data } = await supabase
        .from("posts")
        .select("id, content, created_at, image_paths, video_urls")
        .eq("author_id", targetId)
        .order("created_at", { ascending: false })
        .limit(80);

      const rows = (data ?? []).filter((r: any) => {
        const imgs = Array.isArray(r.image_paths) ? r.image_paths.length : 0;
        const vids = Array.isArray(r.video_urls) ? r.video_urls.length : 0;
        return imgs > 0 || vids > 0;
      });

      setMedia(rows);
      return;
    }

    const { data: eng } = await supabase
      .from("engagements")
      .select("post_id, created_at")
      .eq("user_id", targetId)
      .eq("type", "like")
      .order("created_at", { ascending: false })
      .limit(60);

    const ids = Array.from(new Set((eng ?? []).map((x: any) => Number(x.post_id)).filter(Boolean)));
    if (ids.length === 0) {
      setLikes([]);
      return;
    }

    const { data: likedPosts } = await supabase
      .from("posts")
      .select("id, content, created_at, image_paths, video_urls, author_id")
      .in("id", ids)
      .order("created_at", { ascending: false })
      .limit(60);

    setLikes(likedPosts ?? []);
  }

  async function toggleFollow() {
    if (!profile?.id) return;
    if (!meId) return alert("يجب تسجيل الدخول");
    if (meId === profile.id) return;
    if (followBusy) return;

    setFollowBusy(true);

    const already = isFollowing;

    try {
      if (already) {
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_id", meId)
          .eq("followed_id", profile.id);

        if (error) {
          alert(`فشل إلغاء المتابعة: ${error.message}`);
          return;
        }

        setIsFollowing(false);
        setFollowersCount((n) => Math.max(0, n - 1));
        return;
      }

      const { error } = await supabase.from("followers").insert({
        follower_id: meId,
        followed_id: profile.id,
      });

      if (error) {
        alert(`فشل المتابعة: ${error.message}`);
        return;
      }

      setIsFollowing(true);
      setFollowersCount((n) => n + 1);
    } finally {
      setFollowBusy(false);
    }
  }

  useEffect(() => {
    setLang(getLang());
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;

      const me = await loadMe();
      if (!mounted) return;

      const u = cleanUsername;
      if (!u) {
        setProfile(null);
        setNotFound(ui.notFound);
        setLoading(false);
        return;
      }

      const p = await loadProfileByUsername(u);
      if (!mounted) return;

      if (p?.id) {
        await loadCounts(p.id);
        if (me) await loadFollowState(me, p.id);
        await loadTabData(p.id, "posts");
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanUsername]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      if (!profile?.id) return;
      await loadTabData(profile.id, tab);
    })();
    return () => {
      mounted = false;
    };
  }, [tab, profile?.id]);

  if (loading) {
    return (
      <div className="dr4x-card p-4">
        <div className="text-sm text-slate-600">{ui.loading}</div>
      </div>
    );
  }

  if (!profile || notFound) {
    return (
      <div className="dr4x-card p-6" dir="rtl">
        <div className="text-lg font-semibold text-slate-900 mb-2">{ui.notFound}</div>
        {notFound ? <div className="text-sm text-slate-600 whitespace-pre-wrap">{notFound}</div> : null}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-2xl border border-slate-200 hover:bg-slate-50"
          >
            {ui.back}
          </button>
        </div>
      </div>
    );
  }

  const avatarInitials = initialsFrom(displayName);

  return (
    <div className="space-y-3" dir="rtl">
      <div className="dr4x-card overflow-hidden">
        <div className="relative h-[220px] bg-slate-100">
          {coverUrl ? <Image src={coverUrl} alt="cover" fill className="object-cover" /> : null}
        </div>

        <div className="relative px-5 pb-4">
          <div className="absolute -top-[44px] right-5">
            <div className="h-[108px] w-[108px] rounded-full overflow-hidden border-4 border-white bg-slate-200 shadow-sm">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="avatar" width={108} height={108} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center bg-slate-900 text-white font-bold text-xl">
                  {avatarInitials}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div />
            <div className="flex items-center gap-2">
              {isOwn ? (
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  {ui.edit}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={followBusy}
                  className={[
                    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
                    isFollowing
                      ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                      : "bg-slate-900 text-white hover:bg-slate-800",
                    followBusy ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="h-4 w-4 ml-2" />
                      {ui.following}
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 ml-2" />
                      {ui.follow}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="pt-8">
            <div className="text-2xl font-extrabold text-slate-900 leading-tight">{displayName}</div>
            <div className="text-sm text-slate-500 mt-1">{handle}</div>

            {roleLabel ? (
              <div className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {roleLabel}
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-4 text-sm">
              <Link href={`/u/${profile.username}/following`} className="text-slate-600 hover:underline">
                <span className="font-extrabold text-slate-900">{followingCount}</span>{" "}
                <span className="text-slate-500">{ui.followingLbl}</span>
              </Link>

              <Link href={`/u/${profile.username}/followers`} className="text-slate-600 hover:underline">
                <span className="font-extrabold text-slate-900">{followersCount}</span>{" "}
                <span className="text-slate-500">{ui.followers}</span>
              </Link>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 py-3">
              <TabButton active={tab === "posts"} onClick={() => setTab("posts")}>
                {ui.posts}
              </TabButton>
              <TabButton active={tab === "replies"} onClick={() => setTab("replies")}>
                {ui.replies}
              </TabButton>
              <TabButton active={tab === "media"} onClick={() => setTab("media")}>
                {ui.media}
              </TabButton>
              <TabButton active={tab === "likes"} onClick={() => setTab("likes")}>
                {ui.likes}
              </TabButton>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {tab === "posts" ? <SimpleList rows={posts} emptyLabel="لا توجد منشورات بعد." /> : null}
        {tab === "replies" ? <SimpleList rows={replies} emptyLabel="لا توجد ردود بعد." /> : null}
        {tab === "media" ? <SimpleList rows={media} emptyLabel="لا توجد وسائط بعد." /> : null}
        {tab === "likes" ? <SimpleList rows={likes} emptyLabel="لا توجد إعجابات بعد." /> : null}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-4 py-2 rounded-full text-sm font-semibold transition",
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SimpleList({ rows, emptyLabel }: { rows: any[]; emptyLabel: string }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="dr4x-card p-4">
        <div className="text-sm text-slate-600">{emptyLabel}</div>
      </div>
    );
  }

  return (
    <>
      {rows.map((r: any) => (
        <div key={String(r.id)} className="dr4x-card p-4">
          <div className="text-xs text-slate-500 mb-2">
            {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
          </div>
          <div className="text-sm text-slate-900 whitespace-pre-wrap break-words">
            {typeof r.content === "string" ? r.content : ""}
          </div>
        </div>
      ))}
    </>
  );
}
