// src/app/api/admin/users/moderator/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    // 1) نقرأ التوكن من الهيدر
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "missing access token" },
        { status: 401 }
      );
    }

    // 2) نجيب user.id من التوكن
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { ok: false, error: "invalid access token" },
        { status: 401 }
      );
    }

    const currentUid = userData.user.id;

    // 3) نتأكد أن هذا المستخدم أدمن حقيقي (موجود في admin_users)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: adminRow, error: adminErr } = await adminClient
      .from("admin_users")
      .select("id")
      .eq("id", currentUid)
      .maybeSingle();

    if (adminErr) {
      console.error("admin check error", adminErr);
      throw adminErr;
    }

    if (!adminRow) {
      return NextResponse.json(
        { ok: false, error: "not admin" },
        { status: 403 }
      );
    }

    // 4) نقرأ body: uid + حالة المشرف
    const body = await req.json().catch(() => ({}));
    const uid = String(body.uid || "").trim();
    const makeModerator = Boolean(body.moderator);

    if (!uid) {
      return NextResponse.json(
        { ok: false, error: "uid is required" },
        { status: 400 }
      );
    }

    // 5) نكتب في جدول moderator_roles فقط
    if (makeModerator) {
      // تعيين مشرف: نعطيه كل الصلاحيات مبدئياً (تقدر تعدلها لاحقاً)
      const { error } = await adminClient
        .from("moderator_roles")
        .upsert(
          {
            uid,
            can_delete_posts: true,
            can_ban_users: true,
            can_manage_reports: true,
          },
          { onConflict: "uid" }
        );

      if (error) {
        console.error("upsert moderator_roles error", error);
        throw error;
      }
    } else {
      // إلغاء الإشراف: حذف السطر من moderator_roles
      const { error } = await adminClient
        .from("moderator_roles")
        .delete()
        .eq("uid", uid);

      if (error) {
        console.error("delete moderator_roles error", error);
        throw error;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("admin moderator route error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
