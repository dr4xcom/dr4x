// src/app/api/posts/[id]/delete/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// يحول URL عام/كامل إلى path داخل bucket (لو كنت تخزن روابط كاملة بدل المسار)
function normalizeToStoragePath(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;

  // إذا مخزن path أصلاً مثل: "<uid>/posts/..jpg"
  if (!/^https?:\/\//i.test(s)) return s;

  // إذا مخزن Public URL مثل:
  // .../storage/v1/object/public/post_media/<path>
  // أو .../object/public/post_media/<path>
  const markers = [
    "/storage/v1/object/public/post_media/",
    "/object/public/post_media/",
  ];

  for (const m of markers) {
    const idx = s.indexOf(m);
    if (idx !== -1) {
      const path = s.substring(idx + m.length);
      return path || null;
    }
  }

  // روابط خارجية ما نقدر نحذفها من Storage
  return null;
}

function parsePostId(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = decodeURIComponent(raw).trim();
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  // ✅ Next.js: params is Promise
  const { id } = await context.params;

  const postId = parsePostId(id);
  if (!postId) {
    return NextResponse.json(
      { error: "Bad post id", received: id ?? null },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server",
      },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey);

  // 1) اجلب ميديا التغريدة
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, author_id, image_paths, video_urls")
    .eq("id", postId)
    .single();

  if (postErr || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // 2) اجلب ميديا الردود
  const { data: replies, error: repErr } = await supabase
    .from("replies")
    .select("id, image_urls")
    .eq("post_id", postId);

  if (repErr) {
    return NextResponse.json({ error: repErr.message }, { status: 400 });
  }

  // 3) اجمع الملفات المراد حذفها من Storage
  const filesRaw: unknown[] = [];

  if (Array.isArray((post as any).image_paths))
    filesRaw.push(...(post as any).image_paths);
  if (Array.isArray((post as any).video_urls))
    filesRaw.push(...(post as any).video_urls);

  for (const r of replies ?? []) {
    if (Array.isArray((r as any).image_urls))
      filesRaw.push(...(r as any).image_urls);
  }

  const files = Array.from(
    new Set(filesRaw.map(normalizeToStoragePath).filter(Boolean) as string[])
  );

  // 4) احذف ملفات التخزين (إن وجدت)
  if (files.length) {
    const { error: rmErr } = await supabase.storage
      .from("post_media")
      .remove(files);

    if (rmErr) {
      return NextResponse.json({ error: rmErr.message }, { status: 400 });
    }
  }

  // 5) احذف التغريدة -> CASCADE يحذف replies + engagements تلقائيًا ✅
  const { error: delErr } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, removed_files: files.length });
}
