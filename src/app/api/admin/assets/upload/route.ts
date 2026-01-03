// src/app/api/admin/assets/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ============ Helpers ============

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

// ============ POST ============

export async function POST(req: Request) {
  try {
    // 1) تحقق من التوكن
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return json(401, {
        ok: false,
        error: "Missing Authorization Bearer token",
      });
    }

    // 2) تحقق من متغيرات البيئة
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      // لو متغيرات البيئة غير موجودة → رجّع خطأ داخلي
      // لكن بدون ما يوقف باقي الموقع
      return json(500, {
        ok: false,
        error: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL",
      });
    }

    // 3) إنشاء عميل أدمن (سيرفر فقط)
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 4) نتأكد أن التوكن يعود لمستخدم صحيح
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return json(401, { ok: false, error: "Invalid session" });
    }
    const uid = userData.user.id;

    // 5) تأكيد أن المستخدم أدمن (جدول public.admin_users)
    const { data: adminRow, error: adminCheckErr } = await admin
      .from("admin_users")
      .select("id")
      .eq("id", uid)
      .maybeSingle();

    if (adminCheckErr) {
      // خطأ من قاعدة البيانات → يرجع كـ JSON فقط
      return json(500, { ok: false, error: adminCheckErr.message });
    }
    if (!adminRow) {
      return json(403, { ok: false, error: "Forbidden: not admin" });
    }

    // 6) قراءة الـ form-data
    const form = await req.formData();
    const kindRaw = form.get("kind");
    const kind = String(kindRaw || "asset"); // logo | flash_gif | asset

    const fileField = form.get("file");
    if (!(fileField instanceof File)) {
      return json(400, { ok: false, error: "No file provided" });
    }
    const file = fileField as File;

    // 7) التحقق من نوع الملف
    const mime = file.type || "";
    const allowed =
      mime === "image/png" ||
      mime === "image/jpeg" ||
      mime === "image/webp" ||
      mime === "image/gif" ||
      mime === "image/svg+xml";

    if (!allowed) {
      return json(400, {
        ok: false,
        error: "Only images allowed (png/jpg/webp/gif/svg)",
      });
    }

    // 8) حد أقصى للحجم (10MB)
    const size = (file as any).size ?? 0;
    if (size > 10 * 1024 * 1024) {
      return json(400, {
        ok: false,
        error: "File too large (max 10MB)",
      });
    }

    // 9) تجهيز مسار الرفع في البكت الخاص بالأصول
    const bucket = "site_assets";
    const ext = extFromMime(mime);
    const safeKind = ["logo", "flash_gif", "asset"].includes(kind)
      ? kind
      : "asset";
    const path = `branding/${safeKind}/${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.${ext}`;

    // 10) تحويل الملف إلى Buffer (مسموح لأن runtime = nodejs)
    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);

    // 11) رفع الملف إلى Supabase Storage
    const { error: upErr } = await admin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: mime,
        upsert: true,
      });

    if (upErr) {
      return json(500, { ok: false, error: upErr.message });
    }

    // 12) استخراج رابط عام
    const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pub?.publicUrl || "";

    return json(200, { ok: true, publicUrl, path });
  } catch (e: any) {
    // أي خطأ غير متوقع يتحول لخطأ JSON فقط
    return json(500, {
      ok: false,
      error: e?.message || "Upload failed",
    });
  }
}
