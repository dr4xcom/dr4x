// src/app/api/auth/lookup-email/route.ts
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
    const body = await req.json().catch(() => null);
    const username = String(body?.username || "").trim();
    if (!username) return NextResponse.json({ ok: false, error: "missing username" }, { status: 400 });

    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from("profiles")
      .select("email")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;
    const email = (data as any)?.email || null;

    if (!email) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, email });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "lookup error" }, { status: 500 });
  }
}
