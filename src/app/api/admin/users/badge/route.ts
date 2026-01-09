// src/app/api/admin/users/badge/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function normalizeBadge(v: any): string | null {
  if (v === null || v === undefined) return null;

  const s = String(v).trim();
  if (!s) return null;

  // ✅ توافق خلفي
  if (s === "vip") return "star1";
  if (s === "vip_verified") return "star1_verified";

  // ✅ القيم اللي نستخدمها الآن
  const allowed = new Set([
    "verified",
    "star1",
    "star1_verified",
    "star3_verified",
  ]);

  return allowed.has(s) ? s : null; // لو جات قيمة غريبة نخليها null بدل 400
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    // 1) token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "missing access token" },
        { status: 401 }
      );
    }

    // 2) get current user from token
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

    // 3) service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ✅ نفس تحقق الأدمن اللي عندك في moderator route (admin_users.id)
    const { data: adminRow, error: adminErr } = await adminClient
      .from("admin_users")
      .select("id")
      .eq("id", currentUid)
      .maybeSingle();

    if (adminErr) {
      console.error("admin check error", adminErr);
      return NextResponse.json(
        { ok: false, error: adminErr.message || "admin check failed" },
        { status: 500 }
      );
    }

    if (!adminRow) {
      return NextResponse.json(
        { ok: false, error: "not admin" },
        { status: 403 }
      );
    }

    // 4) body
    const body = await req.json().catch(() => ({}));
    const uid = String(body.uid || "").trim();
    if (!uid) {
      return NextResponse.json(
        { ok: false, error: "uid is required" },
        { status: 400 }
      );
    }

    const badge = normalizeBadge(body.badge);

    // 5) update profiles.badge
    const { error: upErr } = await adminClient
      .from("profiles")
      .update({ badge })
      .eq("id", uid);

    if (upErr) {
      console.error("update badge error", upErr);
      return NextResponse.json(
        { ok: false, error: upErr.message || "update badge failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, badge });
  } catch (e: any) {
    console.error("admin badge route error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
