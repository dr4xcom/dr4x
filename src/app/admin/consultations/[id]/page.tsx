// src/app/admin/consultations/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type ConsultationRow = {
  id: number;
  patient_id: string | null;
  doctor_id: string | null;
  status: string | null;
  scheduled_time: string | null;
  session_link: string | null;
  price: number | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
};

type ConsultationFileRow = {
  id: string;
  consultation_id: number;
  sender_id: string | null;
  kind: string | null;
  object_path: string | null;
  url: string | null;
  title: string | null;
  mime: string | null;
  size_bytes: number | null;
  created_at: string | null;
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

function formatBytes(bytes: number | null | undefined) {
  const b = typeof bytes === "number" ? bytes : 0;
  if (!b) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), sizes.length - 1);
  const val = b / Math.pow(k, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export default function AdminConsultationDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [row, setRow] = useState<ConsultationRow | null>(null);
  const [patient, setPatient] = useState<ProfileRow | null>(null);
  const [doctor, setDoctor] = useState<ProfileRow | null>(null);

  const [files, setFiles] = useState<ConsultationFileRow[]>([]);

  const consultationId = useMemo(() => {
    const raw = params?.id ?? "";
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [params]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        if (!consultationId) {
          setErr("رقم الاستشارة غير صحيح.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("consultations")
          .select("id,patient_id,doctor_id,status,scheduled_time,session_link,price,created_at")
          .eq("id", consultationId)
          .maybeSingle();

        if (error) throw error;

        const c = (data ?? null) as ConsultationRow | null;
        if (!alive) return;

        setRow(c);

        if (!c) {
          setErr("لم يتم العثور على الاستشارة.");
          setLoading(false);
          return;
        }

        // جلب profiles للمريض/الطبيب
        const ids = [c.patient_id, c.doctor_id].filter(Boolean) as string[];
        if (ids.length) {
          const { data: profs, error: profErr } = await supabase
            .from("profiles")
            .select("id,username,full_name,email,whatsapp_number")
            .in("id", ids);

          if (profErr) throw profErr;

          const map = new Map<string, ProfileRow>();
          (profs ?? []).forEach((p: any) => {
            if (p?.id) map.set(p.id, p as ProfileRow);
          });

          setPatient(c.patient_id ? map.get(c.patient_id) ?? null : null);
          setDoctor(c.doctor_id ? map.get(c.doctor_id) ?? null : null);
        }

        // جلب ملفات الاستشارة (consultation_files)
        const { data: f, error: fErr } = await supabase
          .from("consultation_files")
          .select(
            "id,consultation_id,sender_id,kind,object_path,url,title,mime,size_bytes,created_at"
          )
          .eq("consultation_id", consultationId)
          .order("created_at", { ascending: false });

        if (fErr) throw fErr;

        if (!alive) return;
        setFiles((f ?? []) as ConsultationFileRow[]);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر جلب تفاصيل الاستشارة.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [consultationId]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Admin</div>
          <h2 className="text-lg font-extrabold">تفاصيل الاستشارة</h2>
          <div className="text-sm text-slate-300">
            عرض تفاصيل الاستشارة + الملفات (consultation_files) — قراءة فقط بدون تعديل DB/RLS.
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/admin/consultations")}
          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/40"
        >
          الرجوع
        </button>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          جارٍ التحميل…
        </div>
      ) : null}

      {!loading && row ? (
        <>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-extrabold">Consultation #{row.id}</div>
              <span className="text-xs text-slate-500">status: {safeText(row.status)}</span>
              <span className="text-xs text-slate-500">created_at: {safeText(row.created_at)}</span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-300">
              <div>
                <span className="text-slate-500">scheduled_time:</span>{" "}
                <span className="font-semibold">{safeText(row.scheduled_time)}</span>
              </div>
              <div>
                <span className="text-slate-500">price:</span>{" "}
                <span className="font-semibold">{row.price ?? "—"}</span>
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <span className="text-slate-500">session_link:</span>{" "}
                <span className="font-semibold">{safeText(row.session_link)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold mb-2">المريض</div>
              <div className="text-xs text-slate-300 space-y-1">
                <div>
                  <span className="text-slate-500">الاسم:</span>{" "}
                  <span className="font-semibold">{safeText(patient?.full_name)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Username:</span>{" "}
                  <span className="font-semibold">{safeText(patient?.username)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Email:</span>{" "}
                  <span className="font-semibold">{safeText(patient?.email)}</span>
                </div>
                <div>
                  <span className="text-slate-500">WhatsApp:</span>{" "}
                  <span className="font-semibold">{safeText(patient?.whatsapp_number)}</span>
                </div>
                <div>
                  <span className="text-slate-500">UID:</span>{" "}
                  <span className="font-semibold">{safeText(row.patient_id)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold mb-2">الطبيب</div>
              <div className="text-xs text-slate-300 space-y-1">
                <div>
                  <span className="text-slate-500">الاسم:</span>{" "}
                  <span className="font-semibold">{safeText(doctor?.full_name)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Username:</span>{" "}
                  <span className="font-semibold">{safeText(doctor?.username)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Email:</span>{" "}
                  <span className="font-semibold">{safeText(doctor?.email)}</span>
                </div>
                <div>
                  <span className="text-slate-500">WhatsApp:</span>{" "}
                  <span className="font-semibold">{safeText(doctor?.whatsapp_number)}</span>
                </div>
                <div>
                  <span className="text-slate-500">UID:</span>{" "}
                  <span className="font-semibold">{safeText(row.doctor_id)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="text-sm font-semibold">ملفات الاستشارة</div>
              <div className="text-xs text-slate-400">العدد: {files.length}</div>
            </div>

            {files.length === 0 ? (
              <div className="p-4 text-sm text-slate-300">لا توجد ملفات.</div>
            ) : (
              <div className="divide-y divide-slate-800">
                {files.map((f) => (
                  <div key={f.id} className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-extrabold truncate">
                            {f.title?.trim() ? f.title : `File ${f.id}`}
                          </div>
                          <span className="text-xs text-slate-500">kind: {safeText(f.kind)}</span>
                          <span className="text-xs text-slate-500">
                            size: {formatBytes(f.size_bytes)}
                          </span>
                          <span className="text-xs text-slate-500">
                            created_at: {safeText(f.created_at)}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-500">mime:</span>{" "}
                            <span className="font-semibold">{safeText(f.mime)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">sender_id:</span>{" "}
                            <span className="font-semibold">{safeText(f.sender_id)}</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-slate-500">object_path:</span>{" "}
                            <span className="font-semibold">{safeText(f.object_path)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-extrabold text-slate-200 hover:bg-slate-900"
                          >
                            فتح
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="rounded-xl border border-slate-900 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-600 cursor-not-allowed"
                            title="لا يوجد URL محفوظ"
                          >
                            فتح
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
              ملاحظة: العرض فقط. إذا احتجنا حذف/إخفاء ملفات لاحقًا سنفعلها عبر RPC بأقل تعديل ممكن.
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
