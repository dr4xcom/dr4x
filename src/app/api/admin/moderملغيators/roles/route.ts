import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getAccessToken(req: Request): string | null {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return null;
}

function createSupabaseClientWithToken(accessToken: string) {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

// نوع البيانات التي ترجع للواجهة
type ModeratorRow = {
  uid: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  can_delete_posts: boolean;
  can_ban_users: boolean;
  can_manage_reports: boolean;
  created_at: string | null;
};

// GET: جلب قائمة المشرفين
export async function GET(req: Request) {
  try {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing access token" },
        { status: 401 }
      );
    }

    const supabase = createSupabaseClientWithToken(accessToken);

    const { data, error } = await supabase
      .from("moderator_roles")
      .select(
        `
        uid,
        can_delete_posts,
        can_ban_users,
        can_manage_reports,
        created_at,
        profiles!inner (
          id,
          full_name,
          username,
          email
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    const result: ModeratorRow[] =
      (data || []).map((row: any) => ({
        uid: row.uid,
        full_name: row.profiles?.full_name ?? null,
        username: row.profiles?.username ?? null,
        email: row.profiles?.email ?? null,
        can_delete_posts: !!row.can_delete_posts,
        can_ban_users: !!row.can_ban_users,
        can_manage_reports: !!row.can_manage_reports,
        created_at: row.created_at ?? null,
      })) ?? [];

    return NextResponse.json({ moderators: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: إضافة/تعديل أدوار مشرف واحد (upsert)
export async function POST(req: Request) {
  try {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing access token" },
        { status: 401 }
      );
    }

    const supabase = createSupabaseClientWithToken(accessToken);
    const body = await req.json();

    const uid: string | undefined = body.uid;
    const can_delete_posts: boolean = !!body.can_delete_posts;
    const can_ban_users: boolean = !!body.can_ban_users;
    const can_manage_reports: boolean = !!body.can_manage_reports;

    if (!uid) {
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    const { error } = await supabase.from("moderator_roles").upsert(
      {
        uid,
        can_delete_posts,
        can_ban_users,
        can_manage_reports,
      },
      { onConflict: "uid" }
    );

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE: إزالة مشرف (حذف صفه من moderator_roles)
export async function DELETE(req: Request) {
  try {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing access token" },
        { status: 401 }
      );
    }

    const supabase = createSupabaseClientWithToken(accessToken);
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    const { error } = await supabase
      .from("moderator_roles")
      .delete()
      .eq("uid", uid);

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
