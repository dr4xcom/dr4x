// src/components/clinic/ClinicRoomClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { FeatureFlags, getFeatureFlags } from "@/utils/systemSettings";
import ClinicChat from "@/components/clinic/ClinicChat";
import ClinicAttachments from "@/components/clinic/ClinicAttachments";
import PatientVitalsPanel from "@/components/clinic/PatientVitalsPanel";

type QRow = {
  id: string;
  doctor_id: string;
  patient_id: string;
  status: "waiting" | "called" | "in_session" | "done" | "canceled";
  expected_minutes: number | null;
  is_free: boolean | null;
  price: number | null;
  currency: string | null;
  started_at?: string | null;

  position?: number | null;
  requested_at?: string | null;
  note?: string | null;
};

type QueueItem = QRow & {
  patient_display_name: string;
};

type PatientFileRow = {
  id: string;
  patient_id: string;
  consultation_id: number | null;
  storage_path: string;
  file_type: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  public_url: string | null;
  created_at: string;
};

function makeDisplayName(full_name: string | null, username: string | null) {
  const n = (full_name || "").trim();
  if (n) return n;
  const u = (username || "").trim();
  if (u) return u;
  return "—";
}

export default function ClinicRoomClient({
  consultationId,
}: {
  consultationId: string;
}) {
  const [currentId, setCurrentId] = useState<string | null>(
    consultationId || null
  );

  const [me, setMe] = useState<string | null>(null);
  const [row, setRow] = useState<QRow | null>(null);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [role, setRole] = useState<"doctor" | "patient" | "admin" | "unknown">(
    "unknown"
  );
  const [err, setErr] = useState<string | null>(null);

  // أسماء الشخصيات في رأس الصفحة
  const [doctorName, setDoctorName] = useState<string>("—");
  const [patientName, setPatientName] = useState<string>("—");

  // ملفات المريض من patient_files
  const [patientFiles, setPatientFiles] = useState<PatientFileRow[] | null>(
    null
  );
  const [filesErr, setFilesErr] = useState<string | null>(null);

  // قائمة الانتظار للطبيب
  const [queueList, setQueueList] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(false);
  const [queueErr, setQueueErr] = useState<string | null>(null);

  /* ========== 1) المستخدم الحالي + Feature Flags ========== */

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);

        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id ?? null;
        if (!uid) {
          if (!alive) return;
          setErr("يجب تسجيل الدخول.");
          return;
        }
        if (!alive) return;
        setMe(uid);

        const f = await getFeatureFlags();
        if (!alive) return;
        setFlags(f);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Error");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* ========== 2) تحميل الجلسة الحالية + الدور + ملفات المريض + أسماء الطبيب/المريض ========== */

  useEffect(() => {
    if (!me || !currentId) return;

    let alive = true;

    (async () => {
      try {
        setErr(null);
        setFilesErr(null);
        setPatientFiles(null);

        const { data, error } = await supabase
          .from("consultation_queue")
          .select("*")
          .eq("id", currentId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          if (!alive) return;
          setErr("لم يتم العثور على الجلسة / الطلب.");
          return;
        }

        const r = data as any as QRow;
        if (!alive) return;
        setRow(r);

        // تحديد الدور
        if (me === r.doctor_id) setRole("doctor");
        else if (me === r.patient_id) setRole("patient");
        else {
          const { data: adminOk } = await supabase.rpc("is_admin", {
            p_uid: me,
          });
          if (!alive) return;
          setRole(adminOk ? "admin" : "unknown");
        }

        // أسماء الطبيب والمريض من جدول profiles
        try {
          const { data: profs, error: profErr } = await supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", [r.doctor_id, r.patient_id]);

          if (!profErr && profs) {
            for (const p of profs as any[]) {
              if (p.id === r.doctor_id) {
                setDoctorName(makeDisplayName(p.full_name, p.username));
              } else if (p.id === r.patient_id) {
                setPatientName(makeDisplayName(p.full_name, p.username));
              }
            }
          }
        } catch (e) {
          console.error("profiles fetch error", e);
        }

        // ملفات المريض من patient_files (باستخدام patient_id الحقيقي)
        const { data: filesData, error: filesError } = await supabase
          .from("patient_files")
          .select(
            "id, patient_id, consultation_id, storage_path, file_type, public_url, mime_type, size_bytes, created_at"
          )
          .eq("patient_id", r.patient_id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!alive) return;

        if (filesError) {
          console.error(filesError);
          setFilesErr("تعذّر تحميل ملفات المريض الطبية.");
        } else {
          setPatientFiles((filesData || []) as PatientFileRow[]);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Error");
      }
    })();

    return () => {
      alive = false;
    };
  }, [me, currentId]);

  /* ========== 3) قائمة الانتظار للطبيب ========== */

  useEffect(() => {
    if (!me || role !== "doctor") return;

    let alive = true;

    (async () => {
      try {
        setQueueLoading(true);
        setQueueErr(null);

        const { data, error } = await supabase
          .from("consultation_queue")
          .select(
            "id, doctor_id, patient_id, status, expected_minutes, is_free, price, currency, started_at, position, requested_at, note"
          )
          .eq("doctor_id", me)
          .in("status", ["waiting", "called", "in_session"])
          .order("requested_at", { ascending: true });

        if (error) {
          console.error(error);
          if (!alive) return;
          setQueueErr("تعذّر تحميل قائمة الانتظار.");
          setQueueList([]);
          return;
        }

        const rows = (data || []) as QRow[];
        const patientIds = Array.from(new Set(rows.map((r) => r.patient_id)));

        const nameMap = new Map<string, string>();

        if (patientIds.length > 0) {
          const { data: profs, error: profErr } = await supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", patientIds);

          if (profErr) {
            console.error(profErr);
          } else {
            (profs || []).forEach((p: any) => {
              nameMap.set(
                p.id,
                makeDisplayName(p.full_name ?? null, p.username ?? null)
              );
            });
          }
        }

        if (!alive) return;

        const items: QueueItem[] = rows.map((r) => ({
          ...r,
          patient_display_name: nameMap.get(r.patient_id) ?? "مريض",
        }));

        setQueueList(items);

        if (!currentId && items.length > 0) {
          setCurrentId(items[0].id);
        }
      } catch (e: any) {
        if (!alive) return;
        setQueueErr(e?.message ?? "Error");
        setQueueList([]);
      } finally {
        if (alive) setQueueLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [me, role, currentId]);

  /* ========== 4) أزرار بدء / إنهاء الجلسة ========== */

  async function startSession() {
    if (!currentId) return;
    try {
      const startedAt = new Date().toISOString();

      await supabase
        .from("consultation_queue")
        .update({
          status: "in_session",
          started_at: startedAt,
        })
        .eq("id", currentId);

      setRow((r) =>
        r ? { ...r, status: "in_session", started_at: startedAt } : r
      );
      setQueueList((prev) =>
        prev.map((q) =>
          q.id === currentId
            ? { ...q, status: "in_session", started_at: startedAt }
            : q
        )
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function endSession() {
    if (!currentId) return;
    try {
      await supabase
        .from("consultation_queue")
        .update({ status: "done" })
        .eq("id", currentId);

      setRow((r) => (r ? { ...r, status: "done" } : r));
      setQueueList((prev) => prev.filter((q) => q.id !== currentId));
    } catch (e) {
      console.error(e);
    }
  }

  /* ========== 5) صلاحية الدخول + حالة الغرفة ========== */

  const canEnter = useMemo(() => {
    if (!row || !me) return false;
    if (me === row.doctor_id || me === row.patient_id) return true;
    if (role === "admin" && flags?.admin_join_enabled) return true;
    return false;
  }, [row, me, role, flags]);

  const roomDisabledByAdmin = useMemo(() => {
    if (!flags) return false;
    return !flags.live_video_enabled && !flags.live_audio_enabled;
  }, [flags]);

  const headerBadge = useMemo(() => {
    if (!row) return "";
    return `${row.status}${row.is_free ? " • مجاني" : " • مدفوع"}`;
  }, [row]);

  const backHref = useMemo(() => {
    if (role === "doctor") return "/doctor/queue";
    if (role === "patient") return "/patient/queue";
    return "/home";
  }, [role]);

  /* ========== 6) حالات التحميل / الأخطاء ========== */

  if (err) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      </div>
    );
  }

  if (!row || !flags || !currentId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          جارٍ التحميل…
        </div>
      </div>
    );
  }

  if (!canEnter) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          لا تملك صلاحية دخول هذه الغرفة.
        </div>
      </div>
    );
  }

  if (roomDisabledByAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="font-extrabold text-slate-100">
            تم إيقاف غرفة العيادة من الإدارة
          </div>
          <div className="text-sm text-slate-300 mt-1">
            الإدارة أوقفت الصوت والفيديو معًا، لذلك الغرفة مغلقة مؤقتًا.
          </div>
          <div className="mt-3">
            <Link
              href={backHref}
              className="inline-flex rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              الرجوع ➜
            </Link>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          يمكن تشغيلها من: /admin/settings
        </div>
      </div>
    );
  }

  /* ========== 7) الواجهة الرئيسية ========== */

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 p-6 space-y-4">
      {/* خلفية سوداء 50% */}
      <div className="pointer-events-none absolute inset-0 bg-black/50" />

      <div className="relative">
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-emerald-300">Doctor Live Clinic</div>
            <h1 className="text-xl font-extrabold">غرفة العيادة المباشرة</h1>
            <div className="text-sm text-slate-300 mt-1">
              الطبيب:{" "}
              <span className="font-extrabold text-emerald-300">
                {doctorName}
              </span>
            </div>
            <div className="text-sm text-slate-300">
              المريض الحالي:{" "}
              <span className="font-extrabold text-slate-100">
                {patientName}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              حالة الطلب: {headerBadge}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Link
              href={backHref}
              className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              رجوع للطابور ➜
            </Link>

            {role === "admin" && (
              <Link
                href="/admin"
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
              >
                لوحة الإدارة ➜
              </Link>
            )}

            {role === "doctor" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startSession}
                  className="rounded-xl border border-emerald-700 bg-emerald-900/40 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-900"
                >
                  بدء الجلسة
                </button>
                <button
                  type="button"
                  onClick={endSession}
                  className="rounded-xl border border-red-700 bg-red-900/40 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-900"
                >
                  إنهاء الجلسة
                </button>
              </div>
            )}
          </div>
        </div>

        {/* الشبكة العامة */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 mt-4">
          {/* العمود الأيسر: بث + شات + مرفقات */}
          <div className="space-y-4">
            {/* منطقة البث (تصميم بسيط الآن، WebRTC لاحقاً) */}
            <div className="rounded-2xl border border-emerald-500/40 bg-slate-950/60 p-6 flex flex-col items-center justify-center text-center min-h-[260px]">
              <div className="text-sm text-emerald-300 font-semibold mb-2">
                بث مباشر للطبيب والمريض
              </div>
              <div className="text-base text-slate-100 font-extrabold mb-1">
                هنا تظهر صورة / فيديو الطبيب
              </div>
              <div className="text-xs text-slate-400 max-w-md">
                سيتم ربط نظام البث (الصوت / الفيديو) هنا لاحقًا، بدون تغيير
                الجداول. الآن هذه مجرد مساحة لتوضيح مكان البث في التصميم.
              </div>
            </div>

            {/* الشات */}
            <ClinicChat
              consultationId={currentId}
              me={me!}
              role={role}
              disabled={!flags.live_chat_enabled}
            />

            {/* المرفقات */}
            <ClinicAttachments
              consultationId={currentId}
              me={me!}
              role={role}
              patientId={row.patient_id}
              doctorId={row.doctor_id}
              prescriptionsEnabled={flags.prescriptions_enabled}
              attachmentsEnabled={flags.live_attachments_enabled}
            />
          </div>

          {/* العمود الأيمن: قائمة الانتظار + vitals + ملفات المريض + ملخص */}
          <div className="space-y-4">
            {/* قائمة الانتظار للطبيب */}
            {role === "doctor" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="font-bold mb-1">المرضى في قائمة الانتظار</div>
                <div className="text-[11px] text-slate-400 mb-2">
                  اختر المريض لفتح جلسته في الشات والمرفقات والبث.
                </div>

                {queueLoading && (
                  <div className="text-xs text-slate-400">
                    جارٍ تحميل المرضى…
                  </div>
                )}

                {queueErr && (
                  <div className="text-xs text-red-300">{queueErr}</div>
                )}

                {!queueLoading &&
                  !queueErr &&
                  queueList.length === 0 && (
                    <div className="text-xs text-slate-400">
                      لا يوجد مرضى في قائمة الانتظار حاليًا.
                    </div>
                  )}

                {!queueLoading &&
                  !queueErr &&
                  queueList.length > 0 && (
                    <ul className="space-y-1 text-sm">
                      {queueList.map((q) => {
                        const active = q.id === currentId;
                        return (
                          <li key={q.id}>
                            <button
                              type="button"
                              onClick={() => setCurrentId(q.id)}
                              className={[
                                "w-full text-right rounded-lg px-2 py-1 text-xs flex flex-col border",
                                active
                                  ? "border-emerald-400/80 bg-emerald-500/10"
                                  : "border-slate-800 bg-slate-900/60 hover:bg-slate-900",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-50 truncate">
                                  {q.patient_display_name}
                                </span>
                                {q.position != null && (
                                  <span className="text-[10px] text-slate-400">
                                    رقم الدور: {q.position}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                الحالة: {q.status}
                                {q.expected_minutes != null &&
                                  ` • متوقع ${q.expected_minutes} دقيقة`}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </div>
            )}

            {/* العلامات الحيوية */}
            <PatientVitalsPanel
              patientId={row.patient_id}
              disabled={!flags.vitals_panel_enabled}
            />

            {/* ملفات المريض الطبية */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-bold mb-2">ملفات المريض الطبية</div>

              {filesErr && (
                <div className="text-xs text-red-300 mb-2">{filesErr}</div>
              )}

              {!filesErr && patientFiles && patientFiles.length === 0 && (
                <div className="text-sm text-slate-400">
                  لا توجد ملفات طبية مسجّلة لهذا المريض حتى الآن.
                </div>
              )}

              {!filesErr && (!patientFiles || patientFiles === null) && (
                <div className="text-sm text-slate-400">
                  جارٍ تحميل الملفات الطبية...
                </div>
              )}

              {!filesErr && patientFiles && patientFiles.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {patientFiles.slice(0, 8).map((f) => {
                    const name =
                      f.storage_path.split("/").pop() || f.storage_path;
                    return (
                      <li
                        key={f.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/60 px-2 py-1"
                      >
                        <div className="flex-1 min-w-0 text-right">
                          <div className="truncate">
                            {f.file_type ? `[${f.file_type}] ` : ""}
                            {name}
                          </div>
                          {f.consultation_id && (
                            <div className="text-[10px] text-slate-500">
                              مرتبط بجلسة رقم: {f.consultation_id}
                            </div>
                          )}
                        </div>
                        {f.public_url && (
                          <a
                            href={f.public_url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-xs font-semibold text-sky-400 hover:text-sky-200"
                          >
                            عرض
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* ملخص سريع */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-bold mb-2">ملخص تقني</div>
              <div className="text-sm text-slate-300">
                - doctor_id:{" "}
                <span className="text-xs text-slate-400 break-all">
                  {row.doctor_id}
                </span>
                <br />
                - patient_id:{" "}
                <span className="text-xs text-slate-400 break-all">
                  {row.patient_id}
                </span>
                <br />
                - max_visit_minutes:{" "}
                <span className="font-extrabold">
                  {flags.max_visit_minutes}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
