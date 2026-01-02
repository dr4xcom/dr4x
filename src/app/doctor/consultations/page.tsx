// src/app/doctor/consultations/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type ConsultationRow = {
  id: number | string;
  patient_id: string | null;
  doctor_id: string | null;
  scheduled_time: string | null;
  status: string | null;
  session_link: string | null;
  price: number | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

function formatTime(dt: string | null | undefined) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString();
  } catch {
    return dt;
  }
}

function badgeClass(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (!s) return "border-slate-700 bg-slate-900 text-slate-200";
  if (["done", "completed", "closed", "resolved", "finished"].includes(s))
    return "border-emerald-700/60 bg-emerald-950/60 text-emerald-200";
  if (["pending", "waiting", "queued", "in_queue", "new"].includes(s))
    return "border-amber-700/60 bg-amber-950/60 text-amber-200";
  if (["cancelled", "canceled", "rejected", "failed"].includes(s))
    return "border-red-700/60 bg-red-950/60 text-red-200";
  if (["in_progress", "active", "live"].includes(s))
    return "border-sky-700/60 bg-sky-950/60 text-sky-200";
  return "border-slate-700 bg-slate-900 text-slate-200";
}

export default function DoctorConsultationsListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [rows, setRows] = useState<ConsultationRow[]>([]);
  const [patients, setPatients] = useState<Record<string, ProfileRow>>({});

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) المستخدم الحالي
        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const uid = uRes?.user?.id ?? null;
        if (!uid) {
          if (!alive) return;
          setErr("يرجى تسجيل الدخول كطبيب.");
          setLoading(false);
          return;
        }
        if (!alive) return;
        setMeId(uid);

        // 2) جلب الاستشارات الخاصة بالطبيب
        const { data: cRes, error: cErr } = await supabase
          .from("consultations")
          .select(
            "id,patient_id,doctor_id,scheduled_time,status,session_link,price,created_at"
          )
          .eq("doctor_id", uid)
          .order("created_at", { ascending: false })
          .limit(100);

        if (cErr) throw cErr;
        if (!alive) return;

        const list = (cRes ?? []) as ConsultationRow[];
        setRows(list);

        // 3) جلب بيانات المرضى المرتبطين بهذه الاستشارات
        const patientIds = Array.from(
          new Set(
            list
              .map((c) => c.patient_id)
              .filter((v): v is string => typeof v === "string" && !!v)
          )
        );

        if (patientIds.length > 0) {
          const { data: pRes, error: pErr } = await supabase
            .from("profiles")
            .select("id, full_name, username, email")
            .in("id", patientIds);

          if (pErr) {
            console.error("doctor consultations patients error", pErr);
          } else if (pRes && Array.isArray(pRes)) {
            const map: Record<string, ProfileRow> = {};
            for (const p of pRes as any[]) {
              map[p.id] = p as ProfileRow;
            }
            if (alive) setPatients(map);
          }
        }

        setLoading(false);
      } catch (e: any) {
        console.error("doctor consultations list error", e);
        if (!alive) return;
        setErr(
          e?.message ??
            "تعذر تحميل قائمة الاستشارات. قد تكون هناك مشكلة في الصلاحيات أو الاتصال."
        );
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const hasRows = useMemo(() => rows.length > 0, [rows]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Doctor</div>
          <h2 className="text-lg font-extrabold text-slate-100">
            استشاراتي الطبية
          </h2>
          <div className="text-sm text-slate-400">
            من هنا تقدر تشوف كل الاستشارات المرتبطة بحسابك كطبيب، وتدخل غرفة
            الكشف لكل استشارة.
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/home")}
          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/40"
        >
          الرجوع للرئيسية
        </button>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          جارٍ تحميل الاستشارات…
        </div>
      )}

      {!loading && !hasRows && !err && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          لا توجد استشارات حتى الآن لهذا الطبيب.
        </div>
      )}

      {!loading && hasRows && (
        <div className="space-y-3">
          {rows.map((c) => {
            const status = (c.status ?? "").toLowerCase();
            const canEnterRoom =
              status === "in_progress" ||
              status === "active" ||
              status === "live";

            const patient = c.patient_id ? patients[c.patient_id] : null;

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        الاستشارة #{String(c.id)}
                      </span>
                      <span
                        className={[
                          "text-[11px] font-bold rounded-full px-2 py-1 border",
                          badgeClass(c.status),
                        ].join(" ")}
                      >
                        {safeText(c.status)}
                      </span>
                    </div>

                    {patient ? (
                      <div className="text-xs text-slate-300">
                        <span className="text-slate-500">المريض:</span>{" "}
                        <span className="font-semibold">
                          {safeText(patient.full_name)}
                        </span>{" "}
                        <span className="text-slate-500">(@</span>
                        <span className="font-mono">
                          {safeText(patient.username)}
                        </span>
                        <span className="text-slate-500">)</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">
                        لا توجد بيانات مريض (patient_id فارغ).
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      {c.scheduled_time && (
                        <span>الموعد: {formatTime(c.scheduled_time)}</span>
                      )}
                      {c.price != null && (
                        <span>الرسوم: {c.price} ريال</span>
                      )}
                      {c.created_at && (
                        <span>إنشاء: {formatTime(c.created_at)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 min-w-[180px]">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/doctor/consultations/${c.id}`)
                      }
                      disabled={!canEnterRoom}
                      className={[
                        "rounded-full px-4 py-2 text-xs font-semibold",
                        canEnterRoom
                          ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                          : "bg-slate-800 text-slate-400 cursor-not-allowed",
                      ].join(" ")}
                    >
                      دخول غرفة الكشف
                    </button>

                    {!canEnterRoom && (
                      <div className="text-[11px] text-slate-400 text-center">
                        يمكن الدخول لغرفة الكشف فقط عندما تكون حالة الاستشارة
                        <span className="font-semibold text-sky-300">
                          {" "}
                          in_progress / active / live
                        </span>
                        .
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/doctor/consultations/${c.id}`)
                      }
                      className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                    >
                      عرض تفاصيل الاستشارة
                    </button>
                  </div>
                </div>

                {c.session_link?.trim() ? (
                  <div className="mt-2 text-[11px] text-slate-400 break-all">
                    رابط الجلسة (session_link):
                    {" "}
                    <span className="text-sky-300 font-mono">
                      {c.session_link}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
