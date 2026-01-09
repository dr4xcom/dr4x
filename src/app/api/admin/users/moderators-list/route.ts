// src/app/api/admin/users/moderators-list/route.ts
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

    // 3) نتأكد أن هذا المستخدم أدمن (موجود في admin_users)
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

    // 4) نقرأ المشرفين من جدول moderator_roles فقط
    const { data: rows, error: listErr } = await adminClient
      .from("moderator_roles")
      .select("uid");

    if (listErr) {
      console.error("moderators list error", listErr);
      throw listErr;
    }

    const uids = (rows ?? [])
      .map((r: any) => r.uid as string)
      .filter(Boolean);

    return NextResponse.json({ ok: true, uids });
  } catch (e: any) {
    console.error("moderators-list route error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
