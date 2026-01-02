// src/lib/postsFeed/usePostsFeed.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PostRow, ProfileMini, ReplyRow } from "@/lib/postsFeed/utils";
import {
  apiDeleteEngagement,
  apiDeleteReply,
  apiFetchEngagements,
  apiFetchFollowingMap,
  apiFetchPosts,
  apiFetchProfilesByIds,
  apiFetchRepliesByPostId,
  apiFetchReplyCounts,
  apiFollow,
  apiGetMeId,
  apiInsertEngagement,
  apiUnfollow,
  apiUpdatePostContent,
  apiUpdateReplyContent,
} from "@/lib/postsFeed/api";

type EngagementAgg = {
  likeCountByPost: Record<number, number>;
  retweetCountByPost: Record<number, number>;
  iLiked: Record<number, boolean>;
  iRetweeted: Record<number, boolean>;
  iBookmarked: Record<number, boolean>;
};

function aggregateEngagements(rows: { post_id: number; user_id: string; type: string | null }[], meId: string | null): EngagementAgg {
  const likeCountByPost: Record<number, number> = {};
  const retweetCountByPost: Record<number, number> = {};
  const iLiked: Record<number, boolean> = {};
  const iRetweeted: Record<number, boolean> = {};
  const iBookmarked: Record<number, boolean> = {};

  rows.forEach((r) => {
    const pid = r.post_id;
    const t = (r.type || "").toLowerCase();

    if (t === "like") likeCountByPost[pid] = (likeCountByPost[pid] ?? 0) + 1;
    if (t === "retweet") retweetCountByPost[pid] = (retweetCountByPost[pid] ?? 0) + 1;

    if (meId && r.user_id === meId) {
      if (t === "like") iLiked[pid] = true;
      if (t === "retweet") iRetweeted[pid] = true;
      if (t === "bookmark") iBookmarked[pid] = true;
    }
  });

  return { likeCountByPost, retweetCountByPost, iLiked, iRetweeted, iBookmarked };
}

export function usePostsFeed() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileMini>>({});

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [openReplyFor, setOpenReplyFor] = useState<number | null>(null);
  const [repliesByPostId, setRepliesByPostId] = useState<Record<number, ReplyRow[]>>({});
  const [loadingRepliesFor, setLoadingRepliesFor] = useState<number | null>(null);

  const [meId, setMeId] = useState<string | null>(null);

  const [likeCountByPost, setLikeCountByPost] = useState<Record<number, number>>({});
  const [retweetCountByPost, setRetweetCountByPost] = useState<Record<number, number>>({});
  const [iLiked, setILiked] = useState<Record<number, boolean>>({});
  const [iRetweeted, setIRetweeted] = useState<Record<number, boolean>>({});
  const [iBookmarked, setIBookmarked] = useState<Record<number, boolean>>({});

  const [replyCountByPost, setReplyCountByPost] = useState<Record<number, number>>({});

  const [iFollow, setIFollow] = useState<Record<string, boolean>>({});
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});

  const [shareOpen, setShareOpen] = useState<Record<number, boolean>>({});
  const [menuOpen, setMenuOpen] = useState<Record<number, boolean>>({});
  const [replyMenuOpen, setReplyMenuOpen] = useState<Record<number, boolean>>({});

  const emptyState = useMemo(() => !loading && !errorMsg && posts.length === 0, [loading, errorMsg, posts.length]);

  const ensureProfilesLoaded = useCallback(
    async (userIds: string[]) => {
      const missing = userIds.filter((id) => id && !profilesById[id]);
      if (!missing.length) return;

      const profs = await apiFetchProfilesByIds(missing);
      if (!profs.length) return;

      setProfilesById((prev) => {
        const next = { ...prev };
        profs.forEach((p) => {
          next[p.id] = p;
        });
        return next;
      });
    },
    [profilesById]
  );

  const loadReplies = useCallback(
    async (postId: number) => {
      setLoadingRepliesFor(postId);

      const { rows, error } = await apiFetchRepliesByPostId(postId);
      setLoadingRepliesFor(null);

      if (error) {
        console.error(error);
        alert(`فشل تحميل الردود: ${error}`);
        return;
      }

      setRepliesByPostId((prev) => ({ ...prev, [postId]: rows }));

      setReplyCountByPost((prev) => ({
        ...prev,
        [postId]: rows.length > 0 ? Math.max(prev[postId] ?? 0, rows.length) : prev[postId] ?? 0,
      }));

      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      await ensureProfilesLoaded(ids);
    },
    [ensureProfilesLoaded]
  );

  const toggleReply = useCallback(
    (postId: number) => {
      setOpenReplyFor((cur) => (cur === postId ? null : postId));
      if (!repliesByPostId[postId]) void loadReplies(postId);
    },
    [loadReplies, repliesByPostId]
  );

  const loadAll = useCallback(
    async (currentMeId: string | null) => {
      setLoading(true);
      setErrorMsg(null);

      const { posts: postsData, error } = await apiFetchPosts(20);

      if (error) {
        setPosts([]);
        setProfilesById({});
        setLoading(false);
        setErrorMsg(`حدث خطأ أثناء تحميل المنشورات: ${error}`);
        return;
      }

      setPosts(postsData);

      const authorIds = Array.from(new Set(postsData.map((p) => p.author_id).filter(Boolean)));

      if (authorIds.length) {
        const profs = await apiFetchProfilesByIds(authorIds);
        const map: Record<string, ProfileMini> = {};
        profs.forEach((p) => {
          map[p.id] = p;
        });
        setProfilesById(map);
      } else {
        setProfilesById({});
      }

      const postIds = postsData.map((p) => p.id);

      // engagements
      const eng = await apiFetchEngagements(postIds);
      if (!eng.error) {
        const agg = aggregateEngagements(eng.rows, currentMeId);
        setLikeCountByPost(agg.likeCountByPost);
        setRetweetCountByPost(agg.retweetCountByPost);
        setILiked(agg.iLiked);
        setIRetweeted(agg.iRetweeted);
        setIBookmarked(agg.iBookmarked);
      }

      // followers
      if (currentMeId && authorIds.length) {
        const fol = await apiFetchFollowingMap(currentMeId, authorIds);
        if (!fol.error) setIFollow(fol.map);
      }

      // reply counts
      const rc = await apiFetchReplyCounts(postIds);
      if (!rc.error) setReplyCountByPost(rc.map);

      setLoading(false);
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = await apiGetMeId();
      if (!mounted) return;
      setMeId(id);
      await loadAll(id);
    })();
    return () => {
      mounted = false;
    };
  }, [loadAll]);

  const toggleLike = useCallback(
    async (postId: number) => {
      if (!meId) return alert("يجب تسجيل الدخول");

      const already = !!iLiked[postId];

      if (already) {
        const { error } = await apiDeleteEngagement(postId, meId, "like");
        if (error) return alert(error.message);

        setILiked((prev) => ({ ...prev, [postId]: false }));
        setLikeCountByPost((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 0) - 1) }));
        return;
      }

      const { error } = await apiInsertEngagement(postId, meId, "like");
      if (error) return alert(error.message);

      setILiked((prev) => ({ ...prev, [postId]: true }));
      setLikeCountByPost((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    },
    [iLiked, meId]
  );

  const toggleRetweet = useCallback(
    async (postId: number) => {
      if (!meId) return alert("يجب تسجيل الدخول");

      const already = !!iRetweeted[postId];

      if (already) {
        const { error } = await apiDeleteEngagement(postId, meId, "retweet");
        if (error) return alert(error.message);

        setIRetweeted((prev) => ({ ...prev, [postId]: false }));
        setRetweetCountByPost((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 0) - 1) }));
        return;
      }

      const { error } = await apiInsertEngagement(postId, meId, "retweet");
      if (error) return alert(error.message);

      setIRetweeted((prev) => ({ ...prev, [postId]: true }));
      setRetweetCountByPost((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    },
    [iRetweeted, meId]
  );

  const toggleBookmark = useCallback(
    async (postId: number) => {
      if (!meId) return alert("يجب تسجيل الدخول");

      const already = !!iBookmarked[postId];

      if (already) {
        const { error } = await apiDeleteEngagement(postId, meId, "bookmark");
        if (error) return alert(error.message);

        setIBookmarked((p) => ({ ...p, [postId]: false }));
        return;
      }

      const { error } = await apiInsertEngagement(postId, meId, "bookmark");
      if (error) return alert(error.message);

      setIBookmarked((p) => ({ ...p, [postId]: true }));
    },
    [iBookmarked, meId]
  );

  const toggleFollow = useCallback(
    async (authorId: string) => {
      if (!meId) return alert("يجب تسجيل الدخول");
      if (!authorId || authorId === meId) return;

      setFollowBusy((p) => ({ ...p, [authorId]: true }));
      const already = !!iFollow[authorId];

      if (already) {
        const { error } = await apiUnfollow(meId, authorId);
        setFollowBusy((p) => ({ ...p, [authorId]: false }));
        if (error) return alert(error.message);

        setIFollow((p) => ({ ...p, [authorId]: false }));
        return;
      }

      const { error } = await apiFollow(meId, authorId);
      setFollowBusy((p) => ({ ...p, [authorId]: false }));
      if (error) return alert(error.message);

      setIFollow((p) => ({ ...p, [authorId]: true }));
    },
    [iFollow, meId]
  );

  const getPostLink = useCallback((postId: number) => {
    if (typeof window === "undefined") return `/post/${postId}`;
    return `${window.location.origin}/post/${postId}`;
  }, []);

  const copyLink = useCallback(
    async (postId: number) => {
      const link = getPostLink(postId);
      try {
        await navigator.clipboard.writeText(link);
        alert("تم نسخ الرابط ✅");
      } catch {
        window.prompt("انسخ الرابط:", link);
      }
    },
    [getPostLink]
  );

  const shareWhatsApp = useCallback(
    (postId: number) => {
      const link = getPostLink(postId);
      window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, "_blank", "noopener,noreferrer");
    },
    [getPostLink]
  );

  const shareEmail = useCallback(
    (postId: number) => {
      const link = getPostLink(postId);
      window.location.href = `mailto:?subject=${encodeURIComponent("DR4X Post")}&body=${encodeURIComponent(link)}`;
    },
    [getPostLink]
  );

  const deletePost = useCallback(
    async (postId: number) => {
      if (!meId) return alert("يجب تسجيل الدخول");
      const ok = confirm("هل تريد حذف التغريدة؟");
      if (!ok) return;

      const res = await fetch(`/api/posts/${postId}/delete`, { method: "DELETE" });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) return alert(body?.error ?? "فشل الحذف");

      setPosts((prev) => prev.filter((x) => x.id !== postId));
      setOpenReplyFor((cur) => (cur === postId ? null : cur));
    },
    [meId]
  );

  const editPost = useCallback(
    async (postId: number, current: string | null) => {
      if (!meId) return alert("يجب تسجيل الدخول");

      const next = window.prompt("تعديل التغريدة:", current ?? "");
      if (next === null) return;

      const text = next.trim();
      if (!text) return alert("لا يمكن حفظ تغريدة فارغة");

      const { error } = await apiUpdatePostContent(postId, text);
      if (error) return alert(error.message);

      setPosts((prev) => prev.map((x) => (x.id === postId ? { ...x, content: text } : x)));
    },
    [meId]
  );

  const deleteReply = useCallback(
    async (replyId: number, postId: number) => {
      if (!meId) return alert("يجب تسجيل الدخول");

      const ok = confirm("هل تريد حذف الرد؟");
      if (!ok) return;

      const { error } = await apiDeleteReply(replyId);
      if (error) return alert(error.message);

      setRepliesByPostId((prev) => {
        const rows = prev[postId] ?? [];
        return { ...prev, [postId]: rows.filter((r) => r.id !== replyId) };
      });

      setReplyCountByPost((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 0) - 1) }));
    },
    [meId]
  );

  const editReply = useCallback(
    async (replyId: number, postId: number, current: string | null) => {
      if (!meId) return alert("يجب تسجيل الدخول");

      const next = window.prompt("تعديل الرد:", current ?? "");
      if (next === null) return;

      const text = next.trim();
      if (!text) return alert("لا يمكن حفظ رد فارغ");

      const { error } = await apiUpdateReplyContent(replyId, text);
      if (error) return alert(error.message);

      setRepliesByPostId((prev) => {
        const rows = prev[postId] ?? [];
        return { ...prev, [postId]: rows.map((r) => (r.id === replyId ? { ...r, content: text } : r)) };
      });
    },
    [meId]
  );

  const onPostedReply = useCallback(
    async (postId: number) => {
      await loadReplies(postId);
      setOpenReplyFor(null);
      setReplyCountByPost((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    },
    [loadReplies]
  );

  return {
    posts,
    profilesById,

    loading,
    errorMsg,
    emptyState,

    openReplyFor,
    setOpenReplyFor,

    repliesByPostId,
    loadingRepliesFor,

    meId,

    likeCountByPost,
    retweetCountByPost,
    iLiked,
    iRetweeted,
    iBookmarked,

    replyCountByPost,

    iFollow,
    followBusy,

    shareOpen,
    setShareOpen,
    menuOpen,
    setMenuOpen,
    replyMenuOpen,
    setReplyMenuOpen,

    loadReplies,
    toggleReply,
    toggleFollow,
    toggleRetweet,
    toggleLike,
    toggleBookmark,

    shareWhatsApp,
    shareEmail,
    copyLink,

    editPost,
    deletePost,

    editReply,
    deleteReply,

    onPostedReply,
  };
}
