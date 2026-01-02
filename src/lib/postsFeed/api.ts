// src/lib/postsFeed/api.ts
import { supabase } from "@/utils/supabase/client";
import type {
  EngagementRow,
  FollowRow,
  PostRow,
  ProfileMini,
  ReplyRow,
} from "@/lib/postsFeed/utils";

export async function apiGetMeId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function apiFetchPosts(limit = 20): Promise<{
  posts: PostRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, content, image_paths, video_urls, is_retweet, original_post_id, view_count, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { posts: [], error: error.message ?? "Unknown error" };
  return { posts: (data ?? []) as PostRow[], error: null };
}

export async function apiFetchProfilesByIds(ids: string[]): Promise<ProfileMini[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("profiles").select("*").in("id", ids);

  const rows: ProfileMini[] = [];
  (data ?? []).forEach((p: any) => {
    rows.push({
      id: p.id,
      full_name: p.full_name ?? null,
      username: p.username ?? null,
      avatar_url: p.avatar_url ?? null,
      avatar: p.avatar ?? null,
      avatar_path: p.avatar_path ?? null,
      is_verified: p.is_verified ?? null,
      verified: p.verified ?? null,
    });
  });

  return rows;
}

export async function apiFetchRepliesByPostId(postId: number, limit = 50): Promise<{
  rows: ReplyRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("replies")
    .select("id, post_id, user_id, content, created_at, image_urls, youtube_url")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { rows: [], error: error.message ?? "Unknown error" };
  return { rows: (data ?? []) as ReplyRow[], error: null };
}

export async function apiFetchReplyCounts(postIds: number[]): Promise<{
  map: Record<number, number>;
  error: string | null;
}> {
  if (!postIds.length) return { map: {}, error: null };

  const { data, error } = await supabase.from("replies").select("post_id").in("post_id", postIds);

  if (error) return { map: {}, error: error.message ?? "Unknown error" };

  const map: Record<number, number> = {};
  (data ?? []).forEach((r: any) => {
    const pid = Number(r.post_id);
    map[pid] = (map[pid] ?? 0) + 1;
  });

  return { map, error: null };
}

export async function apiFetchEngagements(postIds: number[]): Promise<{
  rows: EngagementRow[];
  error: string | null;
}> {
  if (!postIds.length) return { rows: [], error: null };

  const { data, error } = await supabase
    .from("engagements")
    .select("id, post_id, user_id, type, created_at")
    .in("post_id", postIds);

  if (error) return { rows: [], error: error.message ?? "Unknown error" };
  return { rows: (data ?? []) as EngagementRow[], error: null };
}

export async function apiFetchFollowingMap(meId: string, authorIds: string[]): Promise<{
  map: Record<string, boolean>;
  error: string | null;
}> {
  const ids = authorIds.filter((id) => id && id !== meId);
  if (!meId || !ids.length) return { map: {}, error: null };

  const { data, error } = await supabase
    .from("followers")
    .select("follower_id, followed_id, created_at")
    .eq("follower_id", meId)
    .in("followed_id", ids);

  if (error) return { map: {}, error: error.message ?? "Unknown error" };

  const map: Record<string, boolean> = {};
  (data ?? []).forEach((r: any) => {
    map[r.followed_id] = true;
  });

  return { map, error: null };
}

export async function apiDeleteEngagement(postId: number, meId: string, type: string) {
  return supabase
    .from("engagements")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", meId)
    .eq("type", type);
}

export async function apiInsertEngagement(postId: number, meId: string, type: string) {
  return supabase.from("engagements").insert({
    post_id: postId,
    user_id: meId,
    type,
  });
}

export async function apiUnfollow(meId: string, authorId: string) {
  return supabase.from("followers").delete().eq("follower_id", meId).eq("followed_id", authorId);
}

export async function apiFollow(meId: string, authorId: string) {
  return supabase.from("followers").insert({
    follower_id: meId,
    followed_id: authorId,
  });
}

export async function apiUpdatePostContent(postId: number, text: string) {
  return supabase.from("posts").update({ content: text }).eq("id", postId);
}

export async function apiDeleteReply(replyId: number) {
  return supabase.from("replies").delete().eq("id", replyId);
}

export async function apiUpdateReplyContent(replyId: number, text: string) {
  return supabase.from("replies").update({ content: text }).eq("id", replyId);
}
