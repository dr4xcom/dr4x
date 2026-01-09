// src/app/api/admin/users/moderators-list/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// نجيب uid من الـ Bearer token (نفس الفكرة في باقي admin APIs)
async function getUserIdFromBearer(anon: any, req: Request) {
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7)
    : null;
  if (!token) return null;

  const { data, error } = await anon.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}

// نستعمل نفس RPC is_admin اللي عندك
async function isAdmin(admin: any, uid: string) {
  // ✅ إصلاح TypeScript: Types عندك تعتبر rpc args = undefined
  const { data, error } = await (admin as any).rpc(
    "is_admin",
    { p_uid: uid } as any
  );
  if (error) return false;
  return !!data;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const supabaseServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const anon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // نتأكد أن اللي يطلب القائمة هو أدمن فعليًا
    const uid = await getUserIdFromBearer(anon as any, req);
    if (!uid) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const okAdmin = await isAdmin(admin as any, uid);
    if (!okAdmin) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // نقرأ كل المشرفين من جدول admin_users
    const { data, error } = await admin.from("admin_users").select("uid");
    if (error) {
      throw new Error(error.message);
    }

    const uids =
      (data ?? [])
        .map((row: any) => row?.uid)
        .filter((x: string | null) => !!x) || [];

    return NextResponse.json({ ok: true, uids });
  } catch (e: any) {
    console.error("moderators-list error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
