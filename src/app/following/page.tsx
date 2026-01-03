// src/app/following/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

import AppShell from "@/components/layout/AppShell";
import PostCard from "@/components/posts/PostCard";
import ImageLightbox from "@/components/media/ImageLightbox";

import { Home, Search, Stethoscope, Mail, Bell } from "lucide-react";

import {
  EngagementRow,
  FollowRow,
  PostRow,
  ProfileMini,
  ReplyRow,
} from "@/lib/postsFeed/utils";

/* =========================
   Sidebar Button
   ========================= */
function SidebarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
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
      <span className="text-xl leading-none">{icon}</span>
      <span className="flex-1 text-start">{label}</span>
    </button>
  );
}

/* =========================
   Sidebar (نفس الهوم)
   ========================= */
type ProfileLite = {
  full_name: string | null;
  username: string | null;
  email: string | null;
};

function SidebarMock() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [profile, setProfile] = useState<ProfileLite>({
    full_name: null,
    username: null,
    email: null,
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!user) {
        setProfile({ full_name: null, username: null, email: null });
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      setProfile({
        full_name: data?.full_name ?? null,
        username: data?.username ?? null,
        email: user.email ?? null,
      });
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const displayName =
    profile.full_name?.trim() ||
    profile.username?.trim() ||
    profile.email?.split("@")[0] ||
    "مستخدم";

  const handle =
    profile.username?.trim() ||
    (profile.email ? profile.email.split("@")[0] : "");

  const initials = (() => {
    const s = displayName.trim();
    return ((s[0] ?? "D") + (s[1] ?? "R")).toUpperCase();
  })();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <nav className="space-y-2">
      <SidebarButton
        icon={<Home className="h-5 w-5" />}
        label="الرئيسية"
        onClick={() => router.push("/home")}
      />
      <SidebarButton icon={<Search className="h-5 w-5" />} label="التخصصات" />
      <SidebarButton
        icon={<Stethoscope className="h-5 w-5" />}
        label="الأطباء"
      />
      <SidebarButton icon={<Bell className="h-5 w-5" />} label="التنبيهات" />
      <SidebarButton icon={<Mail className="h-5 w-5" />} label="الرسائل" />

      <div className="pt-4">
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-slate-50 transition">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-bold">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {displayName}
              </div>
              {handle ? (
                <div className="text-xs text-slate-500 truncate">@{handle}</div>
              ) : null}
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

            {menuOpen ? (
              <div className="absolute end-0 bottom-full mb-2 w-44 rounded-2xl border bg-white shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/profile");
                  }}
                  className="w-full text-start px-3 py-3 text-sm hover:bg-slate-50"
                >
                  ملفي الشخصي
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/settings");
                  }}
                  className="w-full text-start px-4 py-3 text-sm hover:bg-slate-50"
                >
                  الإعدادات
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-start px-4 py-3 text-sm text-red-600 hover:bg-slate-50"
                >
                  خروج
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}

/* =========================
   Right Panel (خفيف)
   ========================= */
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
        <div className="font-semibold mb-2">متابعون</div>
        <p className="text-sm text-slate-600">
          تبويبات حقيقية مثل تويتر: المنشورات / الردود / الوسائط / الإعجابات.
        </p>
      </div>
    </div>
  );
}

/* =========================
   Helpers
   ========================= */
function hasMedia(p: PostRow) {
  const imgs = Array.isArray((p as any).image_paths)
    ? ((p as any).image_paths as string[]).filter(Boolean)
    : [];
  const vids = Array.isArray((p as any).video_urls)
    ? ((p as any).video_urls as string[]).filter(Boolean)
    : [];
  return imgs.length > 0 || vids.length > 0;
}

/* =========================
   Page
   ========================= */
export default function FollowingTabsPage() {
  const router = useRouter();

  const TABS = ["posts", "replies", "media", "likes"] as const;
  type Tab = (typeof TABS)[number];

  const [tab, setTab] = useState<Tab>("posts");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [meId, setMeId] = useState<string | null>(null);

  const [myPosts, setMyPosts] = useState<PostRow[]>([]);
  const [myReplies, setMyReplies] = useState<ReplyRow[]>([]);
  const [replyParentPosts, setReplyParentPosts] = useState<PostRow[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostRow[]>([]);

  const [profilesById, setProfilesById] = useState<Record<string, ProfileMini>>(
    {}
  );

  const [likeCountByPost, setLikeCountByPost] = useState<
    Record<number, number>
  >({});
  const [retweetCountByPost, setRetweetCountByPost] = useState<
    Record<number, number>
  >({});
  const [replyCountByPost, setReplyCountByPost] = useState<
    Record<number, number>
  >({});

  const [iLiked, setILiked] = useState<Record<number, boolean>>({});
  const [iRetweeted, setIRetweeted] = useState<Record<number, boolean>>({});
  const [iBookmarked, setIBookmarked] = useState<Record<number, boolean>>({});

  const [iFollow, setIFollow] = useState<Record<string, boolean>>({});
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});

  // menus (PostCard expects)
  const [shareOpen, setShareOpen] = useState<Record<number, boolean>>({});
  const [menuOpen, setMenuOpen] = useState<Record<number, boolean>>({});
  const [replyMenuOpen, setReplyMenuOpen] = useState<Record<number, boolean>>(
    {}
  );

  // replies (PostCard expects)
  const [openReplyFor, setOpenReplyFor] = useState<number | null>(null);
  const [repliesByPostId, setRepliesByPostId] = useState<
    Record<number, ReplyRow[]>
  >({});
  const [loadingRepliesFor, setLoadingRepliesFor] = useState<number | null>(
    null
  );

  // lightbox
  const [lbOpen, setLbOpen] = useState(false);
  const [lbImages, setLbImages] = useState<string[]>([]);
  const [lbIndex, setLbIndex] = useState(0);

  function openLightbox(images: string[], index: number) {
    const safe = (images || []).filter(
      (x) => typeof x === "string" && x.trim()
    );
    if (safe.length === 0) return;
    setLbImages(safe);
    setLbIndex(Math.max(0, Math.min(index, safe.length - 1)));
    setLbOpen(true);
  }

  async function ensureProfilesLoaded(userIds: string[]) {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    const missing = ids.filter((id) => !profilesById[id]);
    if (missing.length === 0) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", missing);
    if (error) return;

    if (data?.length) {
      setProfilesById((prev) => {
        const next = { ...prev };
        data.forEach((p: any) => {
          next[p.id] = {
            id: p.id,
            full_name: p.full_name ?? null,
            username: p.username ?? null,
            avatar_url: p.avatar_url ?? null,
            avatar: p.avatar ?? null,
            avatar_path: p.avatar_path ?? null,
            is_verified: p.is_verified ?? null,
            verified: p.verified ?? null,
          };
        });
        return next;
      });
    }
  }

  async function hydrateCountsAndStates(
    postsToHydrate: PostRow[],
    currentMeId: string
  ) {
    const postIds = Array.from(
      new Set(postsToHydrate.map((p) => p.id).filter(Boolean))
    );

    // engagements
    if (postIds.length) {
      const { data: eData, error: eErr } = await supabase
        .from("engagements")
        .select("id, post_id, user_id, type, created_at")
        .in("post_id", postIds);

      if (!eErr) {
        const rows = (eData ?? []) as EngagementRow[];

        const likeCounts: Record<number, number> = {};
        const rtCounts: Record<number, number> = {};
        const likedByMe: Record<number, boolean> = {};
        const rtByMe: Record<number, boolean> = {};
        const bookmarkedByMe: Record<number, boolean> = {};

        rows.forEach((r) => {
          const pid = Number((r as any).post_id);
          const t = String((r as any).type || "").toLowerCase();

          if (t === "like") likeCounts[pid] = (likeCounts[pid] ?? 0) + 1;
          if (t === "retweet") rtCounts[pid] = (rtCounts[pid] ?? 0) + 1;

          if ((r as any).user_id === currentMeId) {
            if (t === "like") likedByMe[pid] = true;
            if (t === "retweet") rtByMe[pid] = true;
            if (t === "bookmark") bookmarkedByMe[pid] = true;
          }
        });

        setLikeCountByPost((prev) => ({ ...prev, ...likeCounts }));
        setRetweetCountByPost((prev) => ({ ...prev, ...rtCounts }));
        setILiked((prev) => ({ ...prev, ...likedByMe }));
        setIRetweeted((prev) => ({ ...prev, ...rtByMe }));
        setIBookmarked((prev) => ({ ...prev, ...bookmarkedByMe }));
      }
    }

    // replies count
    if (postIds.length) {
      const { data: rCountData, error: rCountErr } = await supabase
        .from("replies")
        .select("post_id")
        .in("post_id", postIds);

      if (!rCountErr) {
        const m: Record<number, number> = {};
        (rCountData ?? []).forEach((x: any) => {
          const pid = Number(x.post_id);
          m[pid] = (m[pid] ?? 0) + 1;
        });
        setReplyCountByPost((prev) => ({ ...prev, ...m }));
      }
    }

    // follow state for authors
    const authorIds = Array.from(
      new Set(postsToHydrate.map((p) => p.author_id).filter(Boolean))
    );
    if (authorIds.length) {
      const { data: fData, error: fErr } = await supabase
        .from("followers")
        .select("follower_id, followed_id, created_at")
        .eq("follower_id", currentMeId)
        .in("followed_id", authorIds);

      if (!fErr) {
        const map: Record<string, boolean> = {};
        (fData ?? []).forEach((r: any) => (map[r.followed_id] = true));
        setIFollow((prev) => ({ ...prev, ...map }));
      }
    }
  }

  async function loadReplies(pid: number) {
    setLoadingRepliesFor(pid);

    const { data, error } = await supabase
      .from("replies")
      .select(
        "id, post_id, user_id, content, created_at, image_urls, youtube_url"
      )
      .eq("post_id", pid)
      .order("created_at", { ascending: false })
      .limit(200);

    setLoadingRepliesFor(null);

    if (error) {
      alert(`فشل تحميل الردود: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as ReplyRow[];
    setRepliesByPostId((prev) => ({ ...prev, [pid]: rows }));
    setReplyCountByPost((prev) => ({ ...prev, [pid]: rows.length }));

    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    await ensureProfilesLoaded(ids);
  }

  function toggleReply(pid: number) {
    setOpenReplyFor((cur) => (cur === pid ? null : pid));
    if (!repliesByPostId[pid]) void loadReplies(pid);
  }

  async function toggleLike(pid: number) {
    if (!meId) return alert("يجب تسجيل الدخول");
    const already = !!iLiked[pid];

    if (already) {
      const { error } = await supabase
        .from("engagements")
        .delete()
        .eq("post_id", pid)
        .eq("user_id", meId)
        .eq("type", "like");
      if (error) return alert(error.message);

      setILiked((prev) => ({ ...prev, [pid]: false }));
      setLikeCountByPost((prev) => ({
        ...prev,
        [pid]: Math.max(0, (prev[pid] ?? 0) - 1),
      }));
      return;
    }

    const { error } = await supabase.from("engagements").insert({
      post_id: pid,
      user_id: meId,
      type: "like",
    });
    if (error) return alert(error.message);

    setILiked((prev) => ({ ...prev, [pid]: true }));
    setLikeCountByPost((prev) => ({ ...prev, [pid]: (prev[pid] ?? 0) + 1 }));
  }

  async function toggleRetweet(pid: number) {
    if (!meId) return alert("يجب تسجيل الدخول");
    const already = !!iRetweeted[pid];

    if (already) {
      const { error } = await supabase
        .from("engagements")
        .delete()
        .eq("post_id", pid)
        .eq("user_id", meId)
        .eq("type", "retweet");
      if (error) return alert(error.message);

      setIRetweeted((prev) => ({ ...prev, [pid]: false }));
      setRetweetCountByPost((prev) => ({
        ...prev,
        [pid]: Math.max(0, (prev[pid] ?? 0) - 1),
      }));
      return;
    }

    const { error } = await supabase.from("engagements").insert({
      post_id: pid,
      user_id: meId,
      type: "retweet",
    });
    if (error) return alert(error.message);

    setIRetweeted((prev) => ({ ...prev, [pid]: true }));
    setRetweetCountByPost((prev) => ({ ...prev, [pid]: (prev[pid] ?? 0) + 1 }));
  }

  async function toggleBookmark(pid: number) {
    if (!meId) return alert("يجب تسجيل الدخول");
    const already = !!iBookmarked[pid];

    if (already) {
      const { error } = await supabase
        .from("engagements")
        .delete()
        .eq("post_id", pid)
        .eq("user_id", meId)
        .eq("type", "bookmark");
      if (error) return alert(error.message);

      setIBookmarked((prev) => ({ ...prev, [pid]: false }));
      return;
    }

    const { error } = await supabase.from("engagements").insert({
      post_id: pid,
      user_id: meId,
      type: "bookmark",
    });
    if (error) return alert(error.message);

    setIBookmarked((prev) => ({ ...prev, [pid]: true }));
  }

  async function toggleFollow(authorId: string) {
    if (!meId) return alert("يجب تسجيل الدخول");
    if (!authorId || authorId === meId) return;

    setFollowBusy((p) => ({ ...p, [authorId]: true }));
    const already = !!iFollow[authorId];

    if (already) {
      const { error } = await supabase
        .from("followers")
        .delete()
        .eq("follower_id", meId)
        .eq("followed_id", authorId);

      setFollowBusy((p) => ({ ...p, [authorId]: false }));
      if (error) return alert(error.message);

      setIFollow((p) => ({ ...p, [authorId]: false }));
      return;
    }

    const { error } = await supabase.from("followers").insert({
      follower_id: meId,
      followed_id: authorId,
    });

    setFollowBusy((p) => ({ ...p, [authorId]: false }));
    if (error) return alert(error.message);

    setIFollow((p) => ({ ...p, [authorId]: true }));
  }

  function getPostLink(pid: number) {
    if (typeof window === "undefined") return `/post/${pid}`;
    return `${window.location.origin}/post/${pid}`;
  }

  async function copyLink(pid: number) {
    const link = getPostLink(pid);
    try {
      await navigator.clipboard.writeText(link);
      alert("تم نسخ الرابط ✅");
    } catch {
      window.prompt("انسخ الرابط:", link);
    }
  }

  function shareWhatsApp(pid: number) {
    const link = getPostLink(pid);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(link)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function shareEmail(pid: number) {
    const link = getPostLink(pid);
    window.location.href = `mailto:?subject=${encodeURIComponent(
      "DR4X Post"
    )}&body=${encodeURIComponent(link)}`;
  }

  async function deletePost(pid: number) {
    const ok = confirm("هل تريد حذف التغريدة؟");
    if (!ok) return;

    const res = await fetch(`/api/posts/${pid}/delete`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) return alert(body?.error ?? "فشل الحذف");

    // remove locally
    setMyPosts((p) => p.filter((x) => x.id !== pid));
    setLikedPosts((p) => p.filter((x) => x.id !== pid));
    setReplyParentPosts((p) => p.filter((x) => x.id !== pid));
  }

  async function editPost(pid: number, current: string | null) {
    const next = window.prompt("تعديل التغريدة:", current ?? "");
    if (next === null) return;

    const text = next.trim();
    if (!text) return alert("لا يمكن حفظ تغريدة فارغة");

    const { error } = await supabase
      .from("posts")
      .update({ content: text })
      .eq("id", pid);
    if (error) return alert(error.message);

    const patch = (arr: PostRow[]) =>
      arr.map((p) => (p.id === pid ? ({ ...p, content: text } as any) : p));
    setMyPosts(patch);
    setLikedPosts(patch);
    setReplyParentPosts(patch);
  }

  async function deleteReply(replyId: number, pid: number) {
    const ok = confirm("هل تريد حذف الرد؟");
    if (!ok) return;

    const { error } = await supabase.from("replies").delete().eq("id", replyId);
    if (error) return alert(error.message);

    setRepliesByPostId((prev) => {
      const rows = prev[pid] ?? [];
      return { ...prev, [pid]: rows.filter((r) => r.id !== replyId) };
    });

    setReplyCountByPost((prev) => ({
      ...prev,
      [pid]: Math.max(0, (prev[pid] ?? 0) - 1),
    }));
  }

  async function editReply(
    replyId: number,
    pid: number,
    current: string | null
  ) {
    const next = window.prompt("تعديل الرد:", current ?? "");
    if (next === null) return;

    const text = next.trim();
    if (!text) return alert("لا يمكن حفظ رد فارغ");

    const { error } = await supabase
      .from("replies")
      .update({ content: text })
      .eq("id", replyId);
    if (error) return alert(error.message);

    setRepliesByPostId((prev) => {
      const rows = prev[pid] ?? [];
      return {
        ...prev,
        [pid]: rows.map((r) =>
          r.id === replyId ? { ...r, content: text } : r
        ),
      };
    });
  }

  function onOpenDetails(pid: number) {
    router.push(`/post/${pid}`);
  }

  // load all tabs data once
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;

        const uid = uRes?.user?.id ?? null;
        if (!uid) {
          router.push("/auth/login");
          return;
        }
        if (!alive) return;
        setMeId(uid);

        // 1) my posts
        const { data: pData, error: pErr } = await supabase
          .from("posts")
          .select(
            "id, author_id, content, image_paths, video_urls, is_retweet, original_post_id, view_count, created_at"
          )
          .eq("author_id", uid)
          .order("created_at", { ascending: false })
          .limit(200);

        if (pErr) throw pErr;

        const posts = (pData ?? []) as PostRow[];
        if (!alive) return;
        setMyPosts(posts);

        // 2) my replies
        const { data: rData, error: rErr } = await supabase
          .from("replies")
          .select(
            "id, post_id, user_id, content, created_at, image_urls, youtube_url"
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(200);

        if (rErr) throw rErr;

        const replies = (rData ?? []) as ReplyRow[];
        if (!alive) return;
        setMyReplies(replies);

        // fetch parent posts for replies tab
        const parentIds = Array.from(
          new Set(replies.map((r) => r.post_id).filter(Boolean))
        );
        let parentPosts: PostRow[] = [];
        if (parentIds.length) {
          const { data: ppData, error: ppErr } = await supabase
            .from("posts")
            .select(
              "id, author_id, content, image_paths, video_urls, is_retweet, original_post_id, view_count, created_at"
            )
            .in("id", parentIds)
            .order("created_at", { ascending: false })
            .limit(500);

          if (ppErr) throw ppErr;
          parentPosts = (ppData ?? []) as PostRow[];
        }
        if (!alive) return;
        setReplyParentPosts(parentPosts);

        // 3) liked posts
        const { data: eData, error: eErr } = await supabase
          .from("engagements")
          .select("post_id")
          .eq("user_id", uid)
          .eq("type", "like")
          .limit(500);

        if (eErr) throw eErr;

        const likedIds = Array.from(
          new Set((eData ?? []).map((x: any) => x.post_id).filter(Boolean))
        );
        let liked: PostRow[] = [];
        if (likedIds.length) {
          const { data: lpData, error: lpErr } = await supabase
            .from("posts")
            .select(
              "id, author_id, content, image_paths, video_urls, is_retweet, original_post_id, view_count, created_at"
            )
            .in("id", likedIds)
            .order("created_at", { ascending: false })
            .limit(500);

          if (lpErr) throw lpErr;
          liked = (lpData ?? []) as PostRow[];
        }
        if (!alive) return;
        setLikedPosts(liked);

        // load profiles for all authors we will render
        const allAuthors = Array.from(
          new Set(
            [...posts, ...parentPosts, ...liked]
              .map((p) => p.author_id)
              .filter(Boolean)
          )
        );

        await ensureProfilesLoaded(allAuthors);

        // hydrate counts/states for everything we could render
        const allToHydrate = [...posts, ...parentPosts, ...liked];
        await hydrateCountsAndStates(allToHydrate, uid);

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر تحميل بيانات التبويبات.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  const mediaPosts = useMemo(() => myPosts.filter(hasMedia), [myPosts]);

  const postsCount = myPosts.length;
  const repliesCount = myReplies.length; // عدد ردودك الحقيقي
  const mediaCount = mediaPosts.length;
  const likesCount = likedPosts.length;

  function renderList(list: PostRow[], label?: string) {
    if (loading)
      return <div className="text-sm text-slate-600 p-4">جاري التحميل...</div>;
    if (!list.length)
      return <div className="text-sm text-slate-500 p-4">لا يوجد عناصر.</div>;

    return (
      <div className="space-y-3 p-3">
        {list.map((post) => (
          <div key={post.id}>
            {label ? (
              <div className="px-2 pb-2 text-xs text-slate-500">{label}</div>
            ) : null}

            <PostCard
              post={post}
              prof={profilesById[post.author_id]}
              meId={meId}
              isOpen={openReplyFor === post.id}
              replies={repliesByPostId[post.id] ?? []}
              likeCount={likeCountByPost[post.id] ?? 0}
              retweetCount={retweetCountByPost[post.id] ?? 0}
              liked={!!iLiked[post.id]}
              retweeted={!!iRetweeted[post.id]}
              replyCount={replyCountByPost[post.id] ?? 0}
              following={!!iFollow[post.author_id]}
              busyFollow={!!followBusy[post.author_id]}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              shareOpen={shareOpen}
              setShareOpen={setShareOpen}
              replyMenuOpen={replyMenuOpen}
              setReplyMenuOpen={setReplyMenuOpen}
              iBookmarked={iBookmarked}
              toggleReply={toggleReply}
              toggleFollow={toggleFollow}
              toggleRetweet={toggleRetweet}
              toggleLike={toggleLike}
              toggleBookmark={toggleBookmark}
              shareWhatsApp={shareWhatsApp}
              shareEmail={shareEmail}
              copyLink={copyLink}
              editPost={editPost}
              deletePost={deletePost}
              // ✅ نعيد Promise<void> صريحة بدلاً من undefined
              editReply={async (replyId, pid, current) => {
                await editReply(replyId, pid, current);
              }}
              deleteReply={async (replyId, pid) => {
                await deleteReply(replyId, pid);
              }}
              loadReplies={(pid) => loadReplies(pid)}
              onPostedReply={async (pid) => {
                await loadReplies(pid);
                setOpenReplyFor(null);
                setReplyCountByPost((prev) => ({
                  ...prev,
                  [pid]: (prev[pid] ?? 0) + 1,
                }));
              }}
              openLightbox={openLightbox}
              profilesById={profilesById}
              loadingRepliesFor={loadingRepliesFor}
              setOpenReplyFor={setOpenReplyFor}
              onOpenDetails={() => onOpenDetails(post.id)}
              mode="feed"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <AppShell
      sidebar={<SidebarMock />}
      header={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="inline-flex items-center justify-center rounded-full w-9 h-9 hover:bg-slate-100"
            title="رجوع"
          >
            ←
          </button>
          <div className="font-semibold">متابعون</div>
        </div>
      }
      rightPanel={<RightPanelMock />}
    >
      <div className="space-y-3">
        <ImageLightbox
          open={lbOpen}
          images={lbImages}
          index={lbIndex}
          onClose={() => setLbOpen(false)}
          onIndexChange={(n) => setLbIndex(n)}
        />

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {err}
          </div>
        ) : null}

        {/* Tabs like Twitter */}
        <div className="dr4x-card bg-white p-0 overflow-hidden">
          <div className="flex gap-2 border-b border-slate-200 px-2">
            <button
              className={[
                "px-4 py-3 text-sm font-semibold rounded-t-xl",
                tab === "posts"
                  ? "text-slate-900 border-b-2 border-sky-500"
                  : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
              onClick={() => setTab("posts")}
              type="button"
            >
              المنشورات{" "}
              <span className="text-xs text-slate-500">({postsCount})</span>
            </button>

            <button
              className={[
                "px-4 py-3 text-sm font-semibold rounded-t-xl",
                tab === "replies"
                  ? "text-slate-900 border-b-2 border-sky-500"
                  : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
              onClick={() => setTab("replies")}
              type="button"
            >
              الردود{" "}
              <span className="text-xs text-slate-500">({repliesCount})</span>
            </button>

            <button
              className={[
                "px-4 py-3 text-sm font-semibold rounded-t-xl",
                tab === "media"
                  ? "text-slate-900 border-b-2 border-sky-500"
                  : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
              onClick={() => setTab("media")}
              type="button"
            >
              الوسائط{" "}
              <span className="text-xs text-slate-500">({mediaCount})</span>
            </button>

            <button
              className={[
                "px-4 py-3 text-sm font-semibold rounded-t-xl",
                tab === "likes"
                  ? "text-slate-900 border-b-2 border-sky-500"
                  : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
              onClick={() => setTab("likes")}
              type="button"
            >
              الإعجابات{" "}
              <span className="text-xs text-slate-500">({likesCount})</span>
            </button>
          </div>

          {/* Content */}
          {tab === "posts" ? renderList(myPosts) : null}

          {tab === "replies"
            ? renderList(
                replyParentPosts,
                "ردّيت على هذا المنشور (افتحه لرؤية الرد داخل التفاصيل)"
              )
            : null}

          {tab === "media" ? renderList(mediaPosts) : null}

          {tab === "likes" ? renderList(likedPosts, "أعجبتك") : null}
        </div>

        <div className="text-xs text-slate-500 px-2 pb-2">
          * i18n: استبدل النصوص بمفاتيح الترجمة حسب نظام تعدد اللغات عندك.
        </div>
      </div>
    </AppShell>
  );
}
