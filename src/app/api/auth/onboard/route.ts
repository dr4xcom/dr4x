// src/app/api/auth/onboard/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function toInt(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ✅ هنا التوقيع الجديد: لا يوجد SupabaseClient ولا ReturnType
async function safeUpsert(
  client: any,
  table: string,
  payload: Record<string, any>,
  onConflict: string
) {
  const { error } = await client.from(table).upsert(payload as any, { onConflict });
  if (error) throw new Error(`${table} upsert error: ${error.message}`);
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => null);
    if (!body?.uid) {
      return NextResponse.json({ ok: false, error: "missing uid" }, { status: 400 });
    }

    const uid = String(body.uid);
    const mode = String(body.mode || "patient");

    const profile = body.profile || {};
    const patient = body.patient || {};
    const doctor = body.doctor || {};

    // 1) profiles
    await safeUpsert(
      supabaseAdmin,
      "profiles",
      {
        id: uid,
        username: profile.username ?? null,
        full_name: profile.full_name ?? null,
        email: profile.email ?? null,
        is_doctor: !!profile.is_doctor,
        whatsapp_number: profile.whatsapp_number ?? null,
      },
      "id"
    );

    if (mode === "patient") {
      // 2) patients
      await safeUpsert(
        supabaseAdmin,
        "patients",
        {
          profile_id: uid,
          nationality: patient.nationality ?? null,
          gender: patient.gender ?? null,
          blood_type: patient.blood_type ?? null,
          chronic_conditions: patient.chronic_conditions ?? null,
          height_cm: patient.height_cm ?? null,
          weight_kg: patient.weight_kg ?? null,
        },
        "profile_id"
      );

      // 3) patient_extra
      await safeUpsert(
        supabaseAdmin,
        "patient_extra",
        {
          patient_id: uid,
          age: patient.age ?? null,
        },
        "patient_id"
      );
    } else {
      // doctors
      await safeUpsert(
        supabaseAdmin,
        "doctors",
        {
          profile_id: uid,
          speciality_id: toInt(doctor.specialty_id),
          rank_id: toInt(doctor.rank_id),
          licence_path: doctor.licence_path ?? null,
        },
        "profile_id"
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "onboard error" },
      { status: 500 }
    );
  }
}
