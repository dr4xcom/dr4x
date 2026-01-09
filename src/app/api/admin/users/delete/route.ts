// src/app/api/admin/users/delete/route.ts
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// ❗ دالة حذف آمنة: لو الجدول غير موجود أو فيه خطأ -> نطبع تحذير ونكمّل
async function safeDelete(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string
) {
  const { error } = await admin.from(table).delete().eq(column, value);

  if (!error) return;

  console.warn(
    `[admin/users/delete] delete from ${table} where ${column}='${value}' -> ${error.message}`
  );
  // 👈 لاحظ: ما في throw هنا أبداً
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const uid = String(body?.uid || "").trim();
    if (!uid) {
      return json(400, { ok: false, error: "missing uid" });
    }

    const token = String(body?.token || "").trim();
    if (!token) {
      return json(401, { ok: false, error: "missing admin token" });
    }

    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ✅ تأكيد أن اللي يطلب الحذف أدمن
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return json(401, { ok: false, error: "invalid admin session" });
    }

    const adminId = userData.user.id;

    const { data: adminRow, error: adminCheckErr } = await admin
      .from("admin_users")
      .select("id")
      .eq("id", adminId)
      .maybeSingle();

    if (adminCheckErr) {
      return json(500, { ok: false, error: adminCheckErr.message });
    }

    if (!adminRow) {
      return json(403, { ok: false, error: "forbidden: not admin" });
    }

    // ================================
    // 1) جداول السوشال (بدون notifications نهائياً)
    // ================================
    await safeDelete(admin, "engagements", "user_id", uid);
    await safeDelete(admin, "replies", "author_id", uid);
    await safeDelete(admin, "reply_attachments", "author_id", uid);
    await safeDelete(admin, "posts", "author_id", uid);
    await safeDelete(admin, "followers", "follower_id", uid);
    await safeDelete(admin, "followers", "following_id", uid);

    // ================================
    // 2) جداول المرضى
    // ================================
    await safeDelete(admin, "patient_record_files", "patient_id", uid);
    await safeDelete(admin, "patient_files", "patient_id", uid);
    await safeDelete(admin, "patient_records", "patient_id", uid);
    await safeDelete(admin, "patient_vitals", "patient_id", uid);
    await safeDelete(admin, "patient_extra", "patient_id", uid);
    await safeDelete(admin, "patients", "profile_id", uid);

    // ================================
    // 3) جداول الأطباء
    // ================================
    await safeDelete(admin, "doctors", "profile_id", uid);

    // ================================
    // 4) البروفايل نفسه
    // ================================
    await safeDelete(admin, "profiles", "id", uid);

    // ================================
    // 5) حذف من Auth
    // ================================
    const { error: authErr } = await admin.auth.admin.deleteUser(uid);
    if (authErr) {
      const msg = (authErr.message || "").toLowerCase();
      if (!msg.includes("user not found")) {
        console.warn(
          "[admin/users/delete] auth delete error:",
          authErr.message
        );
      }
    }

    return json(200, { ok: true });
  } catch (e: any) {
    console.error("admin/users/delete error:", e);
    return json(500, {
      ok: false,
      error: e?.message || "delete error",
    });
  }
}
