// src/components/posts/PostCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  Heart,
  Repeat2,
  UserPlus,
  UserCheck,
  BookOpen,
  Share2,
  Bookmark,
  MoreHorizontal,
  Trash2,
  Pencil,
} from "lucide-react";

import ReplyList from "@/components/posts/ReplyList";
import {
  PostRow,
  ProfileMini,
  ReplyRow,
  extractYouTubeId,
  formatTime,
  getDisplayName,
  getHandle,
  getInitials,
  isProbablyYouTube,
  isVerified,
  getBadge,
} from "@/lib/postsFeed/utils";
import { supabase } from "@/utils/supabase/client";

const AVATAR_BUCKET = "avatars";

function BadgeIcons({ badge }: { badge: ReturnType<typeof getBadge> }) {
  // بدون تغيير “فكرة الشارة” لكن نخليها أيقونات أوضح
  const Check = () => (
    <span
      className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-sky-500 text-white text-[11px] font-black shadow-sm"
      title="موثّق"
    >
      ✓
    </span>
  );

  const Star = ({ n = 1 }: { n?: number }) => (
    <span
      className="inline-flex items-center text-yellow-400 drop-shadow-sm"
      title={n === 1 ? "نجمة" : "نجوم"}
      style={{ lineHeight: 1 }}
    >
      {"★".repeat(Math.max(1, n))}
    </span>
  );

  if (!badge) return null;

  if (badge === "verified") {
    return (
      <span className="inline-flex items-center gap-1">
        <Check />
      </span>
    );
  }

  if (badge === "star1") {
    return (
      <span className="inline-flex items-center gap-1">
        <Star n={1} />
      </span>
    );
  }

  if (badge === "star1_verified") {
    return (
      <span className="inline-flex items-center gap-1">
        <Star n={1} />
        <Check />
      </span>
    );
  }

  // star3_verified
  return (
    <span className="inline-flex items-center gap-1">
      <Star n={3} />
      <Check />
    </span>
  );
}

export default function PostCard({
  post,
  prof,
  meId,

  isOpen,
  replies,

  likeCount,
  retweetCount,
  liked,
  retweeted,
  replyCount,

  following,
  busyFollow,

  menuOpen,
  setMenuOpen,
  shareOpen,
  setShareOpen,
  replyMenuOpen,
  setReplyMenuOpen,

  iBookmarked,

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

  loadReplies,
  onPostedReply,

  openLightbox,

  profilesById,
  loadingRepliesFor,
  setOpenReplyFor,

  onOpenDetails,

  mode = "feed",
}: {
  post: PostRow;
  prof: ProfileMini | undefined;
  meId: string | null;

  isOpen: boolean;
  replies: ReplyRow[];

  likeCount: number;
  retweetCount: number;
  liked: boolean;
  retweeted: boolean;
  replyCount: number;

  following: boolean;
  busyFollow: boolean;

  menuOpen: Record<number, boolean>;
  setMenuOpen: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  shareOpen: Record<number, boolean>;
  setShareOpen: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  replyMenuOpen: Record<number, boolean>;
  setReplyMenuOpen: React.Dispatch<
    React.SetStateAction<Record<number, boolean>>
  >;

  iBookmarked: Record<number, boolean>;

  toggleReply: (postId: number) => void;
  toggleFollow: (authorId: string) => void;
  toggleRetweet: (postId: number) => void;
  toggleLike: (postId: number) => void;
  toggleBookmark: (postId: number) => void;

  shareWhatsApp: (postId: number) => void;
  shareEmail: (postId: number) => void;
  copyLink: (postId: number) => Promise<void>;

  editPost: (postId: number, current: string | null) => Promise<void>;
  deletePost: (postId: number) => Promise<void>;

  editReply: (replyId: number, postId: number, current: string | null) => void;
  deleteReply: (replyId: number, postId: number) => Promise<void>;

  loadReplies: (postId: number) => Promise<void>;
  onPostedReply: (postId: number) => Promise<void>;

  openLightbox: (images: string[], index: number) => void;

  profilesById: Record<string, ProfileMini>;
  loadingRepliesFor: number | null;
  setOpenReplyFor: React.Dispatch<React.SetStateAction<number | null>>;

  onOpenDetails?: (postId: number) => void;

  mode?: "feed" | "details";
}) {
  const router = useRouter();

  const name = getDisplayName(prof);
  const handle = getHandle(prof);
  const verified = isVerified(prof);
  const badge = getBadge(prof); // verified | star1 | star1_verified | star3_verified | null
  const initials = getInitials(name);

  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const p: any = prof ?? {};
        const raw =
          (p.avatar_path as string | null) ??
          (p.avatar_url as string | null) ??
          "";

        const v = (raw || "").trim();
        if (!v) {
          if (alive) setAvatarUrl("");
          return;
        }

        if (
          v.startsWith("http://") ||
          v.startsWith("https://") ||
          v.startsWith("/")
        ) {
          if (alive) setAvatarUrl(v);
          return;
        }

        const { data, error } = await supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(v, 60 * 60);

        if (error) {
          console.error("PostCard avatar signedUrl error", error);
          if (alive) setAvatarUrl("");
          return;
        }

        const url = data?.signedUrl ?? "";
        if (!alive) return;
        setAvatarUrl(
          url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : ""
        );
      } catch (e) {
        console.error("PostCard avatar load error", e);
        if (alive) setAvatarUrl("");
      }
    })();

    return () => {
      alive = false;
    };
  }, [prof]);

  const isMyPost = !!meId && post.author_id === meId;

  const contentText = (post.content ?? "").trim();
  const shouldClamp = mode === "feed";
  const [expanded, setExpanded] = useState(false);

  const looksLong = useMemo(() => {
    if (!contentText) return false;
    return contentText.length > 240 || contentText.includes("\n");
  }, [contentText]);

  const showMore = shouldClamp && !expanded && looksLong;

  function goDetails() {
    if (onOpenDetails) return onOpenDetails(post.id);
    router.push(`/post/${post.id}`);
  }

  const views = Number(post.view_count ?? 0);

  const profileUsername = useMemo(() => {
    const u = (prof as any)?.username ? String((prof as any).username) : "";
    if (u) return u;
    const h = (handle ?? "").toString().trim();
    if (!h) return "";
    return h.startsWith("@") ? h.slice(1) : h;
  }, [prof, handle]);

  const profileHref = profileUsername
    ? `/u/${encodeURIComponent(profileUsername)}`
    : "";

  return (
    <div className="dr4x-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {profileHref ? (
              <Link
                href={profileHref}
                className="shrink-0"
                aria-label="فتح بروفايل المستخدم"
              >
                {avatarUrl ? (
                  <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-bold">
                    {initials}
                  </div>
                )}
              </Link>
            ) : avatarUrl ? (
              <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-bold">
                {initials}
              </div>
            )}

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                {profileHref ? (
                  <Link
                    href={profileHref}
                    className="text-sm font-semibold text-slate-900 truncate"
                    aria-label="فتح بروفايل المستخدم"
                  >
                    {name}
                  </Link>
                ) : (
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {name}
                  </div>
                )}

                {/* ✅ الشارات كأيقونات واضحة */}
                <BadgeIcons badge={badge} />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                {handle ? (
                  profileHref ? (
                    <Link
                      href={profileHref}
                      className="truncate"
                      aria-label="فتح بروفايل المستخدم"
                    >
                      {handle}
                      {verified ? " ✓" : ""}
                    </Link>
                  ) : (
                    <span className="truncate">
                      {handle}
                      {verified ? " ✓" : ""}
                    </span>
                  )
                ) : null}

                <span className="truncate">• {formatTime(post.created_at)}</span>

                {post.is_retweet ? (
                  <span className="text-[11px] text-slate-400">• إعادة</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {meId && post.author_id !== meId ? (
            <button
              type="button"
              onClick={() => toggleFollow(post.author_id)}
              disabled={busyFollow}
              className={[
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition",
                following
                  ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  : "border border-black bg-black text-white hover:bg-black/90",
                busyFollow ? "opacity-60 cursor-not-allowed" : "",
              ].join(" ")}
              title={following ? "إلغاء المتابعة" : "متابعة"}
            >
              {following ? (
                <UserCheck className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>{following ? "متابَع" : "متابعة"}</span>
            </button>
          ) : null}

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setMenuOpen((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
              }
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
              title="المزيد"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen[post.id] ? (
              <div className="absolute z-20 mt-2 left-0 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <button
                  type="button"
                  className="w-full inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setMenuOpen((prev) => ({ ...prev, [post.id]: false }));
                    if (!isMyPost) return alert("غير مسموح");
                    void editPost(post.id, post.content);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  <span>تعديل</span>
                </button>

                <button
                  type="button"
                  className="w-full inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setMenuOpen((prev) => ({ ...prev, [post.id]: false }));
                    if (!isMyPost) return alert("غير مسموح");
                    void deletePost(post.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>حذف</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div
          className={[
            "text-sm text-slate-900 break-anywhere leading-relaxed whitespace-pre-wrap",
            shouldClamp && !expanded ? "line-clamp-5" : "",
          ].join(" ")}
        >
          {contentText ? contentText : ""}
        </div>

        {showMore ? (
          <button
            type="button"
            onClick={goDetails}
            className="mt-2 text-sm text-sky-600 hover:text-sky-700 font-semibold"
          >
            المزيد
          </button>
        ) : null}
      </div>

      {Array.isArray(post.image_paths) && post.image_paths.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.image_paths.map((src, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => openLightbox(post.image_paths || [], idx)}
              className="relative w-[160px] h-[90px] rounded-xl overflow-hidden bg-slate-100"
              title="عرض الصورة"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="post" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {Array.isArray(post.video_urls) && post.video_urls.length > 0 ? (
        <div className="mt-3 space-y-2">
          {post.video_urls.map((url, idx) => {
            const yt = isProbablyYouTube(url) ? extractYouTubeId(url) : null;

            if (yt) {
              return (
                <div
                  key={idx}
                  className="w-full h-[240px] rounded-xl overflow-hidden bg-black"
                >
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${yt}`}
                    allowFullScreen
                    title={`YouTube ${yt}`}
                  />
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="w-full rounded-xl overflow-hidden bg-black"
              >
                <video
                  controls
                  src={url}
                  className="w-full h-[240px] object-cover"
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (mode === "feed") return goDetails();
            toggleReply(post.id);
          }}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
        >
          <MessageCircle className="h-4 w-4" />
          <span>رد</span>
          {replyCount > 0 ? (
            <span className="text-xs text-slate-500">({replyCount})</span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={goDetails}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
          title="اقرأ الردود"
        >
          <BookOpen className="h-4 w-4" />
          {replyCount > 0 ? (
            <span className="text-xs text-slate-500">({replyCount})</span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => toggleRetweet(post.id)}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
          title="إعادة تغريدة"
        >
          <Repeat2 className="h-4 w-4" />
          <span>إعادة</span>
          {retweetCount > 0 ? (
            <span className="text-xs text-slate-500">({retweetCount})</span>
          ) : null}
          {retweeted ? <span className="text-xs text-slate-500">✓</span> : null}
        </button>

        <button
          type="button"
          onClick={() => toggleLike(post.id)}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
          title="إعجاب"
        >
          <Heart className="h-4 w-4" />
          <span>إعجاب</span>
          {likeCount > 0 ? (
            <span className="text-xs text-slate-500">({likeCount})</span>
          ) : null}
          {liked ? <span className="text-xs text-slate-500">✓</span> : null}
        </button>

        <div className="inline-flex items-center gap-3 text-sm text-slate-600">
          <button
            type="button"
            onClick={() => toggleBookmark(post.id)}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
            title="حفظ"
          >
            <Bookmark className="h-4 w-4" />
            {iBookmarked[post.id] ? (
              <span className="text-xs text-slate-500">✓</span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={goDetails}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
            title="المشاهدات"
          >
            <span className="text-sm">{views}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShareOpen((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
              }
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
              title="مشاركة"
            >
              <Share2 className="h-4 w-4" />
            </button>

            {shareOpen[post.id] ? (
              <div className="absolute z-20 mt-2 left-0 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <button
                  type="button"
                  className="w-full rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 text-right"
                  onClick={() => {
                    setShareOpen((prev) => ({ ...prev, [post.id]: false }));
                    shareWhatsApp(post.id);
                  }}
                >
                  واتساب
                </button>

                <button
                  type="button"
                  className="w-full rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 text-right"
                  onClick={() => {
                    setShareOpen((prev) => ({ ...prev, [post.id]: false }));
                    shareEmail(post.id);
                  }}
                >
                  إيميل
                </button>

                <button
                  type="button"
                  className="w-full rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 text-right"
                  onClick={() => {
                    setShareOpen((prev) => ({ ...prev, [post.id]: false }));
                    void copyLink(post.id);
                  }}
                >
                  نسخ الرابط
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {mode === "details" ? (
        <ReplyList
          postId={post.id}
          isOpen={isOpen}
          replies={replies}
          profilesById={profilesById}
          meId={meId}
          loadingRepliesFor={loadingRepliesFor}
          replyMenuOpen={replyMenuOpen}
          setReplyMenuOpen={setReplyMenuOpen}
          onCancelReply={() => setOpenReplyFor(null)}
          onAfterPosted={async () => {
            await onPostedReply(post.id);
          }}
          onLoadReplies={loadReplies}
          onEditReply={(replyId, pid, current) =>
            editReply(replyId, pid, current)
          }
          onDeleteReply={(replyId, pid) => void deleteReply(replyId, pid)}
          openLightbox={openLightbox}
        />
      ) : null}
    </div>
  );
}
