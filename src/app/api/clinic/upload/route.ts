// src/app/api/clinic/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

async function getUserIdFromBearer(anon: any, req: Request) {
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const { data, error } = await anon.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}

async function isAdmin(admin: any, uid: string) {
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
    const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    // 1) client للتحقق من التوكن (anon)
    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2) client للخدمات (service role) — سيرفر فقط
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const uid = await getUserIdFromBearer(supabaseAnon as any, req);
    if (!uid) {
      return NextResponse.json(
        { ok: false, error: "not authenticated" },
        { status: 401 }
      );
    }

    const form = await req.formData();
    const consultationId = String(form.get("consultationId") || "");
    const kind = String(form.get("kind") || ""); // lab_result | prescription
    const file = form.get("file") as File | null;

    if (!consultationId || !file || !kind) {
      return NextResponse.json(
        { ok: false, error: "missing fields" },
        { status: 400 }
      );
    }

    if (!["lab_result", "prescription"].includes(kind)) {
      return NextResponse.json(
        { ok: false, error: "invalid kind" },
        { status: 400 }
      );
    }

    // تحقق صلاحية المستخدم عبر consultation_queue (بدون تعديل أي RLS)
    const { data: qrow, error: qerr } = await supabaseAdmin
      .from("consultation_queue")
      .select("id, doctor_id, patient_id")
      .eq("id", consultationId)
      .maybeSingle();

    if (qerr) throw qerr;
    if (!qrow) {
      return NextResponse.json(
        { ok: false, error: "consultation not found" },
        { status: 404 }
      );
    }

    const adminOk = await isAdmin(supabaseAdmin as any, uid);
    const isDoctor = uid === qrow.doctor_id;
    const isPatient = uid === qrow.patient_id;

    // قواعد رفع بسيطة وآمنة:
    // - المريض يرفع lab_result
    // - الطبيب يرفع prescription
    // - الأدمن مسموح له الاثنين (للطوارئ/الإشراف)
    if (!adminOk) {
      if (kind === "lab_result" && !isPatient) {
        return NextResponse.json(
          { ok: false, error: "patient only" },
          { status: 403 }
        );
      }
      if (kind === "prescription" && !isDoctor) {
        return NextResponse.json(
          { ok: false, error: "doctor only" },
          { status: 403 }
        );
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const bucket = "clinic";
    const path = `${consultationId}/${kind}/${Date.now()}_${safeFileName(
      file.name
    )}`;

    const { error: upErr } = await supabaseAdmin.storage.from(bucket).upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
      cacheControl: "3600",
    });

    if (upErr) throw upErr;

    // رجّع Signed URL مباشرة (مريح للواجهة)
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10); // 10 دقائق

    if (sErr) throw sErr;

    return NextResponse.json({
      ok: true,
      bucket,
      path,
      signedUrl: signed?.signedUrl ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "upload error" },
      { status: 500 }
    );
  }
}
