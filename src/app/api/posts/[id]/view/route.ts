// src/app/api/posts/[id]/view/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parsePostId(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = decodeURIComponent(raw).trim();
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
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

  // ✅ زيادة المشاهدات بشكل صحيح (SQL function)
  const { data, error } = await supabase.rpc("increment_post_view", {
    p_post_id: postId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, view_count: data ?? null });
}
