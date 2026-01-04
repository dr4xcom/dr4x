"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

import ImageLightbox from "@/components/media/ImageLightbox";
import PostCard from "@/components/posts/PostCard";

import {
  EngagementRow,
  FollowRow,
  PostRow,
  ProfileMini,
  ReplyRow,
} from "@/lib/postsFeed/utils";

export default function PostsFeed() {
  const router = useRouter();

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileMini>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [openReplyFor, setOpenReplyFor] = useState<number | null>(null);
  const [repliesByPostId, setRepliesByPostId] = useState<
    Record<number, ReplyRow[]>
  >({});
  const [loadingRepliesFor, setLoadingRepliesFor] = useState<number | null>(
    null
  );

  const [meId, setMeId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false); // ✅ هل المستخدم أدمن؟

  const [likeCountByPost, setLikeCountByPost] = useState<
    Record<number, number>
  >({});
  const [retweetCountByPost, setRetweetCountByPost] = useState<
    Record<number, number>
  >({});
  const [iLiked, setILiked] = useState<Record<number, boolean>>({});
  const [iRetweeted, setIRetweeted] = useState<Record<number, boolean>>({});

  const [replyCountByPost, setReplyCountByPost] = useState<
    Record<number, number>
  >({});

  const [iFollow, setIFollow] = useState<Record<string, boolean>>({});
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});

  const [shareOpen, setShareOpen] = useState<Record<number, boolean>>({});
  const [menuOpen, setMenuOpen] = useState<Record<number, boolean>>({});
  const [replyMenuOpen, setReplyMenuOpen] = useState<Record<number, boolean>>(
    {}
  );

  const [iBookmarked, setIBookmarked] = useState<Record<number, boolean>>({});

  // ✅ Lightbox state
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

  async function loadMe(): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const id = user?.id ?? null;
    setMeId(id);
    return id;
  }

  // ✅ فحص هل المستخدم أدمن عن طريق RPC is_admin
  async function loadIsAdmin(userId: string | null) {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    const { data, error } = await supabase.rpc("is_admin", {
      p_uid: userId,
    });
    if (error) {
      console.warn("is_admin rpc error:", error.message);
      setIsAdmin(false);
      return;
    }
    setIsAdmin(!!data);
  }

  async function loadPostsAndAuthors(currentMeId: string | null) {
    setLoading(true);
    setErrorMsg(null);

    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select(
        "id, author_id, content, image_paths, video_urls, is_retweet, original_post_id, view_count, created_at, pinned_at"
      )
      // ✅ الترتيب: المثبت أولاً ثم الأحدث
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (postsError) {
      setPosts([]);
      setProfilesById({});
      setLoading(false);
      setErrorMsg(
        `حدث خطأ أثناء تحميل المنشورات: ${postsError.message ?? ""}`
      );
      return;
    }

    const safePosts = (postsData ?? []) as PostRow[];
    setPosts(safePosts);

    const authorIds = Array.from(
      new Set(safePosts.map((p) => p.author_id).filter(Boolean))
    );

    if (authorIds.length === 0) {
      setProfilesById({});
      setLoading(false);
      return;
    }

    const { data: profData } = await supabase
      .from("profiles")
      .select("*")
      .in("id", authorIds);

    const map: Record<string, ProfileMini> = {};
    (profData ?? []).forEach((p: any) => {
      map[p.id] = {
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

    setProfilesById(map);

    await loadEngagementsForPosts(safePosts, currentMeId);
    await loadFollowStateForAuthors(authorIds, currentMeId);
    await loadReplyCountsForPosts(safePosts);

    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      const id = await loadMe();
      if (!mounted) return;
      await Promise.all([loadPostsAndAuthors(id), loadIsAdmin(id)]);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emptyState = useMemo(
    () => !loading && !errorMsg && posts.length === 0,
    [loading, errorMsg, posts.length]
  );

  async function ensureProfilesLoaded(userIds: string[]) {
    const missing = userIds.filter((id) => id && !profilesById[id]);
    if (missing.length === 0) return;

    const { data: profData } = await supabase
      .from("profiles")
      .select("*")
      .in("id", missing);

    if (profData?.length) {
      setProfilesById((prev) => {
        const next = { ...prev };
        profData.forEach((p: any) => {
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

  async function loadReplies(postId: number) {
    setLoadingRepliesFor(postId);

    const { data, error } = await supabase
      .from("replies")
      .select(
        "id, post_id, user_id, content, created_at, image_urls, youtube_url"
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(50);

    setLoadingRepliesFor(null);

    if (error) {
      console.error(error);
      alert(`فشل تحميل الردود: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as ReplyRow[];

    setRepliesByPostId((prev) => ({
      ...prev,
      [postId]: rows,
    }));

    setReplyCountByPost((prev) => ({
      ...prev,
      [postId]:
        rows.length > 0
          ? Math.max(prev[postId] ?? 0, rows.length)
          : prev[postId] ?? 0,
    }));

    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    await ensureProfilesLoaded(ids);
  }

  // ✅ في الهوم: زر الرد ينقل للتفاصيل بدل فتح ردود هنا
  function toggleReply(postId: number) {
    router.push(`/post/${postId}`);
  }

  async function loadReplyCountsForPosts(pst: PostRow[]) {
    const postIds = pst.map((p) => p.id);
    if (postIds.length === 0) {
      setReplyCountByPost({});
      return;
    }

    const { data, error } = await supabase
      .from("replies")
      .select("post_id")
      .in("post_id", postIds);

    if (error) {
      console.error("loadReplyCounts error:", error);
      return;
    }

    const map: Record<number, number> = {};
    (data ?? []).forEach((r: any) => {
      const pid = Number(r.post_id);
      map[pid] = (map[pid] ?? 0) + 1;
    });

    setReplyCountByPost(map);
  }

  async function loadEngagementsForPosts(
    pst: PostRow[],
    currentMeId: string | null
  ) {
    const postIds = pst.map((p) => p.id);
    if (postIds.length === 0) {
      setLikeCountByPost({});
      setRetweetCountByPost({});
      setILiked({});
      setIRetweeted({});
      setIBookmarked({});
      return;
    }

    const { data, error } = await supabase
      .from("engagements")
      .select("id, post_id, user_id, type, created_at")
      .in("post_id", postIds);

    if (error) {
      console.error("loadEngagements error:", error);
      return;
    }

    const rows = (data ?? []) as EngagementRow[];

    const likeCounts: Record<number, number> = {};
    const rtCounts: Record<number, number> = {};
    const likedByMe: Record<number, boolean> = {};
    const rtByMe: Record<number, boolean> = {};
    const bookmarkedByMe: Record<number, boolean> = {};

    rows.forEach((r) => {
      const pid = r.post_id;
      const t = (r.type || "").toLowerCase();

      if (t === "like") likeCounts[pid] = (likeCounts[pid] ?? 0) + 1;
      if (t === "retweet") rtCounts[pid] = (rtCounts[pid] ?? 0) + 1;

      if (currentMeId && r.user_id === currentMeId) {
        if (t === "like") likedByMe[pid] = true;
        if (t === "retweet") rtByMe[pid] = true;
        if (t === "bookmark") bookmarkedByMe[pid] = true;
      }
    });

    setLikeCountByPost(likeCounts);
    setRetweetCountByPost(rtCounts);
    setILiked(likedByMe);
    setIRetweeted(rtByMe);
    setIBookmarked(bookmarkedByMe);
  }

  async function toggleLike(postId: number) {
    if (!meId) return alert("يجب تسجيل الدخول");

    const already = !!iLiked[postId];

    if (already) {
      const { error } = await supabase
        .from("engagements")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", meId)
        .eq("type", "like");

      if (error) return alert(error.message);

      setILiked((prev) => ({ ...prev, [postId]: false }));
      setLikeCountByPost((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] ?? 0) - 1),
      }));
      return;
    }

    const { error } = await supabase.from("engagements").insert({
      post_id: postId,
      user_id: meId,
      type: "like",
    });

    if (error) return alert(error.message);

    setILiked((prev) => ({ ...prev, [postId]: true }));
    setLikeCountByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? 0) + 1,
    }));
  }

  async function toggleRetweet(postId: number) {
    if (!meId) return alert("يجب تسجيل الدخول");

    const already = !!iRetweeted[postId];

    if (already) {
      const { error } = await supabase
        .from("engagements")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", meId)
        .eq("type", "retweet");

      if (error) return alert(error.message);

      setIRetweeted((prev) => ({ ...prev, [postId]: false }));
      setRetweetCountByPost((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] ?? 0) - 1),
      }));
      return;
    }

    const { error } = await supabase.from("engagements").insert({
      post_id: postId,
      user_id: meId,
      type: "retweet",
    });

    if (error) return alert(error.message);

    setIRetweeted((prev) => ({ ...prev, [postId]: true }));
    setRetweetCountByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? 0) + 1,
    }));
  }

  async function toggleBookmark(postId: number) {
    if (!meId) return alert("يجب تسجيل الدخول");

    const already = !!iBookmarked[postId];

    if (already) {
      const { error } = await supabase
        .from("engagements")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", meId)
        .eq("type", "bookmark");

      if (error) return alert(error.message);

      setIBookmarked((p) => ({ ...p, [postId]: false }));
      return;
    }

    const { error } = await supabase.from("engagements").insert({
      post_id: postId,
      user_id: meId,
      type: "bookmark",
    });

    if (error) return alert(error.message);

    setIBookmarked((p) => ({ ...p, [postId]: true }));
  }

  async function loadFollowStateForAuthors(
    authorIds: string[],
    currentMeId: string | null
  ) {
    if (!currentMeId) return;
    const ids = authorIds.filter((id) => id && id !== currentMeId);
    if (ids.length === 0) return;

    const { data, error } = await supabase
      .from("followers")
      .select("follower_id, followed_id, created_at")
      .eq("follower_id", currentMeId)
      .in("followed_id", ids);

    if (error) return console.error("loadFollowState error:", error);

    const _rows = (data ?? []) as unknown as FollowRow;
    const map: Record<string, boolean> = {};
    (data ?? []).forEach((r: any) => (map[r.followed_id] = true));
    setIFollow(map);
  }

  // ✅✅✅ (المعدل فقط): جعل toggleFollow أكثر أمانًا + رسائل أوضح
  async function toggleFollow(authorId: string) {
    if (!meId) return alert("يجب تسجيل الدخول");
    if (!authorId || authorId === meId) return;

    // منع الضغط المتكرر أثناء العملية
    if (followBusy[authorId]) return;

    setFollowBusy((p) => ({ ...p, [authorId]: true }));

    const already = !!iFollow[authorId];

    try {
      if (already) {
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_id", meId)
          .eq("followed_id", authorId);

        if (error) {
          // غالباً RLS أو صلاحيات
          alert(
            `فشل إلغاء المتابعة: ${error.message}\n` +
              `إذا كان عندك RLS على جدول followers، أرسل صورة Policies للجدول فقط.`
          );
          return;
        }

        setIFollow((p) => ({ ...p, [authorId]: false }));
        return;
      }

      const { error } = await supabase.from("followers").insert({
        follower_id: meId,
        followed_id: authorId,
      });

      if (error) {
        alert(
          `فشل المتابعة: ${error.message}\n` +
            `إذا كان عندك RLS على جدول followers، أرسل صورة Policies للجدول فقط.`
        );
        return;
      }

      setIFollow((p) => ({ ...p, [authorId]: true }));
    } finally {
      setFollowBusy((p) => ({ ...p, [authorId]: false }));
    }
  }

  function getPostLink(postId: number) {
    if (typeof window === "undefined") return `/post/${postId}`;
    return `${window.location.origin}/post/${postId}`;
  }

  async function copyLink(postId: number) {
    const link = getPostLink(postId);
    try {
      await navigator.clipboard.writeText(link);
      alert("تم نسخ الرابط ✅");
    } catch {
      window.prompt("انسخ الرابط:", link);
    }
  }

  function shareWhatsApp(postId: number) {
    const link = getPostLink(postId);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(link)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function shareEmail(postId: number) {
    const link = getPostLink(postId);
    window.location.href = `mailto:?subject=${encodeURIComponent(
      "DR4X Post"
    )}&body=${encodeURIComponent(link)}`;
  }

  async function deletePost(postId: number) {
    if (!meId) return alert("يجب تسجيل الدخول");
    const ok = confirm("هل تريد حذف التغريدة؟");
    if (!ok) return;

    const res = await fetch(`/api/posts/${postId}/delete`, {
      method: "DELETE",
    });
    const body = await res.json().catch(() => ({} as any));

    if (!res.ok) return alert(body?.error ?? "فشل الحذف");

    setPosts((prev) => prev.filter((x) => x.id !== postId));
    setOpenReplyFor((cur) => (cur === postId ? null : cur));
  }

  async function editPost(postId: number, current: string | null) {
    if (!meId) return alert("يجب تسجيل الدخول");

    const next = window.prompt("تعديل التغريدة:", current ?? "");
    if (next === null) return;

    const text = next.trim();
    if (!text) return alert("لا يمكن حفظ تغريدة فارغة");

    const { error } = await supabase
      .from("posts")
      .update({ content: text })
      .eq("id", postId);
    if (error) return alert(error.message);

    setPosts((prev) =>
      prev.map((x) => (x.id === postId ? { ...x, content: text } : x))
    );
  }

  async function deleteReply(replyId: number, postId: number) {
    if (!meId) return alert("يجب تسجيل الدخول");

    const ok = confirm("هل تريد حذف الرد؟");
    if (!ok) return;

    const { error } = await supabase
      .from("replies")
      .delete()
      .eq("id", replyId);
    if (error) return alert(error.message);

    setRepliesByPostId((prev) => {
      const rows = prev[postId] ?? [];
      return { ...prev, [postId]: rows.filter((r) => r.id !== replyId) };
    });

    setReplyCountByPost((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? 0) - 1),
    }));
  }

  async function editReply(
    replyId: number,
    postId: number,
    current: string | null
  ) {
    if (!meId) return alert("يجب تسجيل الدخول");

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
      const rows = prev[postId] ?? [];
      return {
        ...prev,
        [postId]: rows.map((r) =>
          r.id === replyId ? { ...r, content: text } : r
        ),
      };
    });
  }

  // ✅ زر تثبيت / إلغاء التثبيت (للأدمن فقط)
  async function togglePin(postId: number, currentlyPinned: boolean) {
    if (!meId) return alert("يجب تسجيل الدخول");
    if (!isAdmin) return alert("فقط المدير يمكنه تثبيت المنشورات");

    const newPinnedAt = currentlyPinned ? null : new Date().toISOString();

    const { error } = await supabase
      .from("posts")
      .update({ pinned_at: newPinnedAt })
      .eq("id", postId);

    if (error) {
      alert(`فشل تغيير حالة التثبيت: ${error.message}`);
      return;
    }

    // تحديث الحالة محليًا حتى يظهر التثبيت فورًا
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? ({ ...p, pinned_at: newPinnedAt } as any)
          : p
      )
    );
  }

  return (
    <div className="space-y-3">
      <ImageLightbox
        open={lbOpen}
        images={lbImages}
        index={lbIndex}
        onClose={() => setLbOpen(false)}
        onIndexChange={(n) => setLbIndex(n)}
      />

      {loading ? (
        <div className="text-sm text-slate-600">جاري تحميل المنشورات...</div>
      ) : null}
      {errorMsg ? (
        <div className="text-sm text-red-600">{errorMsg}</div>
      ) : null}

      {emptyState ? (
        <div className="text-sm text-slate-600">
          لا توجد منشورات بعد. ابدأ بأول منشور 👋
        </div>
      ) : null}

      {posts.map((p) => {
        const prof = profilesById[p.author_id];

        const isOpen = openReplyFor === p.id;
        const replies = repliesByPostId[p.id] ?? [];

        const likeCount = likeCountByPost[p.id] ?? 0;
        const retweetCount = retweetCountByPost[p.id] ?? 0;

        const liked = !!iLiked[p.id];
        const retweeted = !!iRetweeted[p.id];

        const following = !!iFollow[p.author_id];
        const busyFollow = !!followBusy[p.author_id];

        const replyCount = replyCountByPost[p.id] ?? 0;

        const isPinned = !!(p as any).pinned_at;

        return (
          <div key={p.id} className="space-y-1">
            {isAdmin && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => togglePin(p.id, isPinned)}
                  className="text-[11px] px-2 py-1 rounded-full border border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white transition"
                >
                  {isPinned ? "إلغاء التثبيت" : "تثبيت في الأعلى"}
                </button>
              </div>
            )}

            <PostCard
              post={p}
              prof={prof}
              meId={meId}
              isOpen={isOpen}
              replies={replies}
              likeCount={likeCount}
              retweetCount={retweetCount}
              liked={liked}
              retweeted={retweeted}
              replyCount={replyCount}
              following={following}
              busyFollow={busyFollow}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              shareOpen={shareOpen}
              setShareOpen={setShareOpen}
              replyMenuOpen={replyMenuOpen}
              setReplyMenuOpen={setReplyMenuOpen}
              iBookmarked={iBookmarked}
              toggleReply={toggleReply} // ✅ ينقل للتفاصيل
              toggleFollow={toggleFollow}
              toggleRetweet={toggleRetweet}
              toggleLike={toggleLike}
              toggleBookmark={toggleBookmark}
              shareWhatsApp={shareWhatsApp}
              shareEmail={shareEmail}
              copyLink={copyLink}
              editPost={editPost}
              deletePost={deletePost}
              editReply={(replyId, postId, current) =>
                void editReply(replyId, postId, current)
              }
              deleteReply={(replyId, postId) => deleteReply(replyId, postId)}
              loadReplies={loadReplies}
              onPostedReply={async (postId) => {
                await loadReplies(postId);
                setOpenReplyFor(null);
                setReplyCountByPost((prev) => ({
                  ...prev,
                  [postId]: (prev[postId] ?? 0) + 1,
                }));
              }}
              openLightbox={openLightbox}
              profilesById={profilesById}
              loadingRepliesFor={loadingRepliesFor}
              setOpenReplyFor={setOpenReplyFor}
              onOpenDetails={(id) => router.push(`/post/${id}`)}
              mode="feed" // ✅ مهم: قصّ 5 أسطر + لا ردود بالهوم
            />
          </div>
        );
      })}
    </div>
  );
}
