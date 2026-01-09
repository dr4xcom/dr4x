// src/lib/postsFeed/utils.ts

/* =========================
   Types
========================= */

export type PostRow = {
  id: number;
  author_id: string;
  content: string | null;
  image_paths: string[] | null;
  video_urls: string[] | null;
  is_retweet: boolean | null;
  original_post_id: number | null;
  view_count: number | null;
  created_at: string;
};

export type ProfileMini = {
  id: string;
  full_name: string | null;
  username: string | null;

  avatar_url?: string | null;
  avatar?: string | null;
  avatar_path?: string | null;

  is_verified?: boolean | null;
  verified?: boolean | null;

  // ✅ شارة المستخدم (تدار من لوحة التحكم)
  // القيم المدعومة:
  // null | verified | star1 | star1_verified | star3_verified
  badge?: string | null;
};

export type ReplyRow = {
  id: number;
  post_id: number;
  user_id: string;
  content: string | null;
  created_at: string;
  image_urls: string[] | null;
  youtube_url: string | null;
};

export type EngagementRow = {
  id: number;
  post_id: number;
  user_id: string;
  type: string;
  created_at: string;
};

export type FollowRow = {
  follower_id: string;
  followed_id: string;
  created_at: string;
};

/* =========================
   Helpers
========================= */

export function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getDisplayName(p?: ProfileMini) {
  return p?.full_name?.trim() || p?.username?.trim() || "مستخدم";
}

export function getHandle(p?: ProfileMini) {
  const u = p?.username?.trim();
  return u ? `@${u}` : "";
}

export function getAvatarUrl(p?: ProfileMini) {
  const v = (p?.avatar_url ?? p?.avatar ?? p?.avatar_path ?? null) || null;
  return v && v.trim() ? v : null;
}

export function isVerified(p?: ProfileMini) {
  return p?.is_verified === true || p?.verified === true;
}

/**
 * ✅ قراءة الشارة بطريقة آمنة
 * تستخدم في PostCard فقط للعرض
 */
export function getBadge(
  p?: ProfileMini
): "verified" | "star1" | "star1_verified" | "star3_verified" | null {
  const v = (p as any)?.badge;
  if (
    v === "verified" ||
    v === "star1" ||
    v === "star1_verified" ||
    v === "star3_verified"
  ) {
    return v;
  }
  return null;
}

export function getInitials(name: string) {
  const s = name.trim();
  const a = s[0] ?? "D";
  const b = s[1] ?? "R";
  return (a + b).toUpperCase();
}

/* =========================
   YouTube helpers
========================= */

export function extractYouTubeId(url: string): string | null {
  const u = (url || "").trim();
  if (!u) return null;

  const m1 = u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m1?.[1]) return m1[1];

  const m2 = u.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m2?.[1]) return m2[1];

  const m3 = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (m3?.[1]) return m3[1];

  const m4 = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (m4?.[1]) return m4[1];

  return null;
}

export function isProbablyYouTube(url: string) {
  const u = (url || "").toLowerCase();
  return u.includes("youtube.com") || u.includes("youtu.be");
}
