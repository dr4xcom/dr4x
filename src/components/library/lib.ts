import { supabase } from "@/utils/supabase/client";
import type { LibraryBook, LibraryCategory, LibraryCounts } from "./types";

export function publicLibraryUrl(path: string) {
  return supabase.storage.from("library").getPublicUrl(path).data.publicUrl;
}

export function getSessionKey(): string {
  if (typeof window === "undefined") return "server";
  const key = "dr4x_library_session_key";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const v = crypto.randomUUID();
  sessionStorage.setItem(key, v);
  return v;
}

export async function fetchCategories(): Promise<LibraryCategory[]> {
  const { data, error } = await supabase
    .from("library_categories")
    .select("id,name,slug,sort_order,hero_image_path")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LibraryCategory[];
}

/**
 * Global banner:
 * We treat the banner as hero_image_path of the FIRST category by sort_order.
 */
export async function fetchGlobalBannerUrl(): Promise<string | null> {
  const { data, error } = await supabase
    .from("library_categories")
    .select("hero_image_path")
    .order("sort_order", { ascending: true })
    .limit(1);

  if (error) return null;
  const path = data?.[0]?.hero_image_path ?? null;
  if (!path) return null;

  // hero_image_path can be:
  // - a full https url
  // - OR a storage path (covers/... etc) inside bucket library
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return publicLibraryUrl(path);
}

export async function fetchApprovedBooksByCategoryAndShelf(
  categoryId: string,
  shelf: "scientific" | "prophetic" | "folk",
  limit = 14,
  offset = 0
): Promise<LibraryBook[]> {
  const { data, error } = await supabase
    .from("library_books")
    .select(
      "id,title,author_name,description,toc,category_id,cover_path,preview_file_path,full_file_path,preview_enabled,is_paid,price,currency,status,review_reason,submitted_by_user_id,approved_by_user_id,approved_at,created_at,shelf"
    )
    .eq("category_id", categoryId)
    .eq("shelf", shelf)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as LibraryBook[];
}

export async function fetchApprovedBook(
  bookId: string
): Promise<LibraryBook | null> {
  const { data, error } = await supabase
    .from("library_books")
    .select(
      "id,title,author_name,description,toc,category_id,cover_path,preview_file_path,full_file_path,preview_enabled,is_paid,price,currency,status,review_reason,submitted_by_user_id,approved_by_user_id,approved_at,created_at,shelf"
    )
    .eq("id", bookId)
    .eq("status", "approved")
    .single();

  if (error) return null;
  return data as LibraryBook;
}

export async function fetchCounts(
  bookId: string
): Promise<LibraryCounts | null> {
  const { data, error } = await supabase.rpc("library_book_counts", {
    p_book_id: bookId,
  });
  if (error) return null;

  // RPC returns a single row (table) in PostgREST
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    view_preview_count: Number(row.view_preview_count ?? 0),
    download_click_count: Number(row.download_click_count ?? 0),
    download_success_count: Number(row.download_success_count ?? 0),
  };
}

export async function logEvent(
  bookId: string,
  type: "view_preview" | "download_click" | "download_success"
) {
  const sessionKey = getSessionKey();
  await supabase.rpc("library_log_event", {
    p_book_id: bookId,
    p_event_type: type,
    p_session_key: sessionKey,
  });
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  // ✅ توحيد صلاحيات المكتبة مع صلاحيات الأدمن العامة (admin_users) عبر RPC الرسمي
  // ✅ هذا نفس المنطق المستخدم في AdminGate
  // ✅ لا يعتمد على SELECT مباشر من admin_users (قد يُمنع بـ RLS)
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) return false;

  const uid = auth?.user?.id;
  if (!uid) return false;

  const { data: adminOk, error } = await supabase.rpc("is_admin", {
    p_uid: uid,
  });
  if (error) return false;

  return !!adminOk;
}
