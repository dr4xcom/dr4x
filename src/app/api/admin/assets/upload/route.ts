// src/app/api/admin/assets/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function extFromMime(mime: string) {
  if (!mime) return "bin";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  return "bin";
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    if (!token) return json(401, { ok: false, error: "Missing Authorization Bearer token" });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return json(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // verify user from token
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json(401, { ok: false, error: "Invalid session" });
    const uid = userData.user.id;

    // check admin (table public.admin_users)
    const { data: adminRow, error: adminCheckErr } = await admin
      .from("admin_users")
      .select("id")
      .eq("id", uid)
      .maybeSingle();

    if (adminCheckErr) return json(500, { ok: false, error: adminCheckErr.message });
    if (!adminRow) return json(403, { ok: false, error: "Forbidden: not admin" });

    const form = await req.formData();
    const kind = String(form.get("kind") || "asset"); // logo | flash_gif | asset
    const file = form.get("file") as unknown as File | null;

    if (!file) return json(400, { ok: false, error: "No file provided" });

    const mime = file.type || "";
    const allowed =
      mime === "image/png" ||
      mime === "image/jpeg" ||
      mime === "image/webp" ||
      mime === "image/gif" ||
      mime === "image/svg+xml";

    if (!allowed) {
      return json(400, { ok: false, error: "Only images allowed (png/jpg/webp/gif/svg)" });
    }

    // optional size limit (10MB)
    const size = (file as any).size ?? 0;
    if (size > 10 * 1024 * 1024) {
      return json(400, { ok: false, error: "File too large (max 10MB)" });
    }

    const bucket = "site_assets";
    const ext = extFromMime(mime);
    const safeKind = ["logo", "flash_gif", "asset"].includes(kind) ? kind : "asset";
    const path = `branding/${safeKind}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);

    const { error: upErr } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType: mime,
      upsert: true,
    });

    if (upErr) return json(500, { ok: false, error: upErr.message });

    const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pub?.publicUrl || "";

    return json(200, { ok: true, publicUrl, path });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Upload failed" });
  }
}
