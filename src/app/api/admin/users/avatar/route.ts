// src/app/api/admin/users/avatar/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const AVATAR_BUCKET = "avatars";
const MAX_MB = 2;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const userId = form.get("userId");
    const file = form.get("file");

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, error: "userId مفقود" },
        { status: 400 }
      );
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "ملف الصورة مفقود" },
        { status: 400 }
      );
    }

    // تحقق من النوع والحجم
    const okType = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ].includes(file.type);
    if (!okType) {
      return NextResponse.json(
        {
          success: false,
          error: "صيغة الصورة غير مدعومة. استخدم JPG/PNG/WebP/GIF.",
        },
        { status: 400 }
      );
    }
    const mb = file.size / (1024 * 1024);
    if (mb > MAX_MB) {
      return NextResponse.json(
        {
          success: false,
          error: `حجم الصورة كبير. الحد الأقصى ${MAX_MB}MB.`,
        },
        { status: 400 }
      );
    }

    // تجهيز الامتداد + البفر
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
        ? "gif"
        : "jpg";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const path = `${userId}/avatar.${ext}`;

    const { error: upErr } = await adminClient.storage
      .from(AVATAR_BUCKET)
      .upload(path, buffer, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type,
      });

    if (upErr) {
      return NextResponse.json(
        { success: false, error: upErr.message },
        { status: 400 }
      );
    }

    // تحديث مسار avatar_path في profiles
    const { error: dbErr } = await adminClient
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", userId);

    if (dbErr) {
      return NextResponse.json(
        { success: false, error: dbErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, path });
  } catch (e: any) {
    console.error("admin avatar upload error", e);
    return NextResponse.json(
      { success: false, error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
