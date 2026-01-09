// src/app/api/admin/users/ban/route.ts
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

export async function POST(req: Request) {
  try {
    const { userId, banned } = await req.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, error: "userId مفقود" },
        { status: 400 }
      );
    }

    const b = Boolean(banned);

    // نجلب المستخدم أولاً حتى لا نرمي metadata القديمة
    const { data: userData, error: getErr } =
      await adminClient.auth.admin.getUserById(userId);
    if (getErr || !userData?.user) {
      return NextResponse.json(
        { success: false, error: getErr?.message ?? "User not found" },
        { status: 404 }
      );
    }

    const prevMeta = userData.user.user_metadata ?? {};
    const newMeta = { ...prevMeta, banned: b };

    const { error: updErr } = await adminClient.auth.admin.updateUserById(
      userId,
      {
        user_metadata: newMeta,
      }
    );

    if (updErr) {
      return NextResponse.json(
        { success: false, error: updErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("admin ban user error", e);
    return NextResponse.json(
      { success: false, error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
