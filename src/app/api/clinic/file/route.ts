// src/app/api/clinic/file/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function getUserIdFromBearer(anon: ReturnType<typeof createClient>, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const { data, error } = await anon.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}

// ✅ تخفيف التايب هنا فقط حتى لا يعترض TypeScript على rpc مع p_uid
async function isAdmin(admin: any, uid: string) {
  const { data, error } = await (admin as any).rpc("is_admin", { p_uid: uid } as any);
  if (error) return false;
  return !!data;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const uid = await getUserIdFromBearer(supabaseAnon, req);
    if (!uid) return NextResponse.json({ ok: false, error: "not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const path = String(body?.path || "");
    const bucket = String(body?.bucket || "clinic");
    const expiresIn = Number(body?.expiresIn || 600); // 10 دقائق

    if (!path) return NextResponse.json({ ok: false, error: "missing path" }, { status: 400 });

    // نستنتج consultationId من أول جزء من المسار
    const consultationId = path.split("/")[0] || "";
    if (!consultationId) {
      return NextResponse.json({ ok: false, error: "invalid path" }, { status: 400 });
    }

    // تحقق صلاحية الوصول عبر consultation_queue
    const { data: qrow, error: qerr } = await supabaseAdmin
      .from("consultation_queue")
      .select("id, doctor_id, patient_id")
      .eq("id", consultationId)
      .maybeSingle();

    if (qerr) throw qerr;
    if (!qrow) {
      return NextResponse.json({ ok: false, error: "consultation not found" }, { status: 404 });
    }

    const adminOk = await isAdmin(supabaseAdmin, uid);
    const ok = adminOk || uid === qrow.doctor_id || uid === qrow.patient_id;
    if (!ok) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) throw error;

    return NextResponse.json({ ok: true, signedUrl: data?.signedUrl ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "file error" }, { status: 500 });
  }
}
