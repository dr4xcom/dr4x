// src/app/doctor/clinic/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { FeatureFlags, getFeatureFlags } from "@/utils/systemSettings";
import ConsultationChat from "@/components/clinic/ConsultationChat";
import { FileText, PhoneOff } from "lucide-react";

type ProfileRow = {
  id: string;
  full_name: string | null;
  is_doctor: boolean | null;
};

type QueueRow = {
  id: string;
  doctor_id: string;
  patient_id: string;
  status: string;
  is_free: boolean | null;
  price: number | null;
  currency: string | null;
  requested_at: string | null;
};

type PatientProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
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

type VitalRow = {
  id: string;
  patient_id: string;
  vital_type: string;
  value_numeric: number | null;
  value2_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  recorded_at: string | null;
};

type PatientExtraRow = {
  patient_id: string;
  age: number | null;
};

export default function DoctorClinicPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [flags, setFlags] = useState<FeatureFlags | null>(null);

  const [queueRows, setQueueRows] = useState<QueueRow[]>([]);
  const [patientProfiles, setPatientProfiles] = useState<
    Record<string, PatientProfile>
  >({});
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);

  const [patientFiles, setPatientFiles] = useState<PatientFileRow[] | null>(
    null
  );
  const [filesErr, setFilesErr] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);

  const [vitals, setVitals] = useState<VitalRow[] | null>(null);
  const [vitalsErr, setVitalsErr] = useState<string | null>(null);
  const [vitalsLoading, setVitalsLoading] = useState(false);

  const [patientExtra, setPatientExtra] = useState<PatientExtraRow | null>(
    null
  );

  // الوصفة
  const [showPrescription, setShowPrescription] = useState(false);
  const [prescriptionText, setPrescriptionText] = useState("");
  const [prescriptionErr, setPrescriptionErr] = useState<string | null>(null);
  const [prescriptionSaving, setPrescriptionSaving] = useState(false);

  const selectedRow = useMemo(
    () => queueRows.find((r) => r.id === selectedQueueId) || null,
    [queueRows, selectedQueueId]
  );

  const selectedPatientProfile = useMemo(() => {
    if (!selectedRow) return null;
    return patientProfiles[selectedRow.patient_id] ?? null;
  }, [selectedRow, patientProfiles]);

  const waitingCount = useMemo(
    () => queueRows.filter((r) => r.status === "waiting").length,
    [queueRows]
  );

  const mainComplaint: string | null = useMemo(() => {
    if (!vitals || vitals.length === 0) return null;
    const byType = (t: string) =>
      vitals.find(
        (v) => v.vital_type === t && (v.value_text || v.value_numeric !== null)
      );
    const candidate =
      byType("complaint") ||
      byType("note") ||
      vitals.find((v) => v.vital_type.toLowerCase().includes("complaint"));
    return candidate?.value_text || null;
  }, [vitals]);

  const loadPatientFiles = useCallback(async (patientId: string) => {
    try {
      setFilesErr(null);
      setFilesLoading(true);
      setPatientFiles(null);

      const { data, error } = await supabase
        .from("patient_files")
        .select(
          "id, patient_id, consultation_id, storage_path, file_type, mime_type, size_bytes, public_url, created_at"
        )
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("patient_files error", error);
        setFilesErr("تعذّر تحميل ملفات المريض الطبية.");
        setPatientFiles([]);
        return;
      }

      setPatientFiles((data || []) as PatientFileRow[]);
    } catch (e: any) {
      console.error("patient_files unexpected error", e);
      setFilesErr(e?.message ?? "تعذّر تحميل ملفات المريض الطبية.");
      setPatientFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  const loadPatientVitals = useCallback(async (patientId: string) => {
    try {
      setVitalsErr(null);
      setVitalsLoading(true);
      setVitals(null);

      const { data, error } = await supabase
        .from("patient_vitals")
        .select(
          "id, patient_id, vital_type, value_numeric, value2_numeric, value_text, unit, recorded_at"
        )
        .eq("patient_id", patientId)
        .order("recorded_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("patient_vitals error", error);
        setVitalsErr("تعذّر تحميل العلامات الحيوية.");
        setVitals([]);
        return;
      }

      setVitals((data || []) as VitalRow[]);
    } catch (e: any) {
      console.error("patient_vitals unexpected error", e);
      setVitalsErr(e?.message ?? "تعذّر تحميل العلامات الحيوية.");
      setVitals([]);
    } finally {
      setVitalsLoading(false);
    }
  }, []);

  const loadPatientExtra = useCallback(async (patientId: string) => {
    try {
      setPatientExtra(null);
      const { data, error } = await supabase
        .from("patient_extra")
        .select("patient_id, age")
        .eq("patient_id", patientId)
        .maybeSingle();

      if (error) {
        console.error("patient_extra error", error);
        return;
      }

      setPatientExtra((data as PatientExtraRow) || null);
    } catch (e) {
      console.error("patient_extra unexpected error", e);
    }
  }, []);

  const handleEndSession = useCallback(async () => {
    if (!selectedRow) return;
    if (!window.confirm("هل تريد إنهاء الجلسة الحالية؟")) return;

    try {
      const { error } = await supabase
        .from("consultation_queue")
        .update({ status: "done" })
        .eq("id", selectedRow.id);

      if (error) {
        console.error("end session error", error);
        alert(
          "تعذّر إنهاء الجلسة، تحقق من الصلاحيات أو جدول consultation_queue."
        );
        return;
      }

      setQueueRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
      setSelectedQueueId(null);
      setPatientFiles(null);
      setVitals(null);
      setPatientExtra(null);
    } catch (e) {
      console.error("end session unexpected", e);
      alert("حدث خطأ غير متوقع أثناء إنهاء الجلسة.");
    }
  }, [selectedRow]);

  const currentPatientBasicName =
    selectedPatientProfile?.full_name ||
    selectedPatientProfile?.username ||
    "" ||
    null;

  const handleSavePrescription = useCallback(async () => {
    if (!selectedRow) {
      setPrescriptionErr("اختر مريضًا من قائمة الانتظار أولاً.");
      return;
    }

    const body = prescriptionText.trim();
    if (!body) {
      setPrescriptionErr("اكتب نص الوصفة قبل الحفظ.");
      return;
    }

    try {
      setPrescriptionSaving(true);
      setPrescriptionErr(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        setPrescriptionErr("يجب تسجيل الدخول بحساب الطبيب لحفظ الوصفة.");
        setPrescriptionSaving(false);
        return;
      }

      const uid = authData.user.id;
      const name = currentPatientBasicName || "مريض";
      const ageLine =
        patientExtra?.age != null ? `العمر: ${patientExtra.age} سنة` : null;

      const text = [`وصفة طبية للمريض: ${name}`, ageLine || undefined, "", body]
        .filter(Boolean)
        .join("\n");

      const { error: insertErr } = await supabase
        .from("consultation_messages")
        .insert({
          queue_id: selectedRow.id,
          sender_role: "doctor",
          sender_id: uid,
          text,
        });

      if (insertErr) {
        console.error("prescription insert error", insertErr);
        setPrescriptionErr("تعذّر حفظ الوصفة في الشات.");
        setPrescriptionSaving(false);
        return;
      }

      setPrescriptionSaving(false);
      setShowPrescription(false);
      setPrescriptionText("");
    } catch (e: any) {
      console.error("save prescription unexpected", e);
      setPrescriptionErr(e?.message ?? "حدث خطأ غير متوقع أثناء حفظ الوصفة.");
      setPrescriptionSaving(false);
    }
  }, [selectedRow, prescriptionText, currentPatientBasicName, patientExtra]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;

        const uid = uRes.user?.id ?? null;
        if (!uid) {
          if (!alive) return;
          router.push("/auth/login");
          return;
        }

        try {
          const { data: adminRes, error: adminErr } = await supabase.rpc(
            "is_admin",
            { p_uid: uid }
          );
          if (adminErr) console.error("is_admin error", adminErr);
          if (alive) setIsAdmin(!!adminRes);
        } catch (e) {
          console.error("is_admin unexpected error", e);
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, is_doctor")
          .eq("id", uid)
          .maybeSingle();

        if (error) throw error;
        if (!alive) return;

        const prof = (data ?? null) as ProfileRow | null;

        if (!prof && !isAdmin) {
          setErr("لم يتم العثور على ملفك في النظام.");
          setLoading(false);
          return;
        }

        setProfile(prof);

        if (!prof?.is_doctor && !isAdmin) {
          setErr("هذه الصفحة مخصصة لحسابات الأطباء فقط.");
          setLoading(false);
          return;
        }

        try {
          const f = await getFeatureFlags();
          if (alive) setFlags(f);
        } catch (e) {
          console.error("getFeatureFlags error", e);
        }

        const doctorId = prof?.id ?? uid;

        const { data: qData, error: qErr } = await supabase
          .from("consultation_queue")
          .select(
            "id, doctor_id, patient_id, status, is_free, price, currency, requested_at"
          )
          .eq("doctor_id", doctorId)
          .in("status", ["waiting", "called", "in_session"])
          .order("requested_at", { ascending: true });

        if (qErr) {
          console.error("consultation_queue error", qErr);
          if (alive) setQueueRows([]);
        } else if (alive) {
          const rows = (qData || []) as QueueRow[];
          setQueueRows(rows);

          const patientIds = Array.from(
            new Set(rows.map((r) => r.patient_id).filter(Boolean))
          );

          if (patientIds.length > 0) {
            const { data: pData, error: pErr } = await supabase
              .from("profiles")
              .select("id, full_name, username")
              .in("id", patientIds);

            if (pErr) {
              console.error("profiles for patients error", pErr);
            } else {
              const map: Record<string, PatientProfile> = {};
              (pData || []).forEach((p: any) => {
                map[p.id] = {
                  id: p.id,
                  full_name: p.full_name,
                  username: p.username,
                };
              });
              if (alive) setPatientProfiles(map);
            }
          }

          if (rows.length > 0) {
            const first = rows[0];
            if (alive) setSelectedQueueId(first.id);
            await Promise.all([
              loadPatientFiles(first.patient_id),
              loadPatientVitals(first.patient_id),
              loadPatientExtra(first.patient_id),
            ]);
          }
        }

        if (alive) setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error("DoctorClinicPage error", e);
        setErr(e?.message ?? "تعذر تحميل صفحة العيادة.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, loadPatientFiles, loadPatientVitals, loadPatientExtra, isAdmin]);

  const handleSelectPatient = useCallback(
    async (rowId: string) => {
      const row = queueRows.find((r) => r.id === rowId);
      if (!row) return;
      setSelectedQueueId(rowId);

      await Promise.all([
        loadPatientFiles(row.patient_id),
        loadPatientVitals(row.patient_id),
        loadPatientExtra(row.patient_id),
      ]);
    },
    [queueRows, loadPatientFiles, loadPatientVitals, loadPatientExtra]
  );

  const displayName = (profile?.full_name ?? "").trim() || "عيادة الطبيب";

  const roomDisabledByAdmin = useMemo(() => {
    if (!flags) return false;
    return !flags.live_video_enabled && !flags.live_audio_enabled;
  }, [flags]);

  const chatDisabled = !flags || !flags.live_chat_enabled || !selectedRow;

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm">جارٍ فتح غرفة العيادة…</div>
      </div>
    );
  }

  if (err && !isAdmin) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-100 space-y-3">
          <div className="font-bold text-base">لا يمكن فتح غرفة العيادة</div>
          <div>{err}</div>
          <div className="flex justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl px-4 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs sm:text-sm text-slate-100"
            >
              رجوع للصفحة السابقة
            </button>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="rounded-xl px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-xs sm:text-sm text-slate-900 font-semibold"
            >
              الذهاب للرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (roomDisabledByAdmin) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-sm text-slate-100 space-y-2">
          <div className="font-bold text-base">
            تم إيقاف غرفة العيادة من الإدارة
          </div>
          <div className="text-slate-300">
            تم تعطيل البث الصوتي والمرئي من لوحة التحكم، لذلك الغرفة مغلقة
            مؤقتًا.
          </div>
          <div className="text-xs text-slate-500">
            يمكن تعديل الإعدادات من صفحة /admin/settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    // ✅ أهم تعديل: الصفحة نفسها هي اللي تسوي scroll حتى لو الـ layout مانع
    <div className="fixed inset-0 z-[9999] bg-slate-950 text-slate-100 overflow-y-auto overscroll-contain">
      <div className="pointer-events-none absolute inset-0 bg-black/40" />

      <div className="relative flex flex-col min-h-[100dvh]">
        {/* ✅ sticky عشان يبقى فوق أثناء النزول */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-slate-800 bg-slate-950/90">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-slate-900 text-slate-100 border border-slate-700 hover:bg-slate-800 text-xs sm:text-sm"
          >
            <span className="text-lg leading-none">↩</span>
            <span>رجوع</span>
          </button>

          <div className="text-center space-y-1">
            <div className="text-[11px] sm:text-xs text-emerald-300 tracking-wide">
              Doctor Live Clinic
            </div>
            <div className="text-base sm:text-xl font-extrabold">
              غرفة العيادة المباشرة
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400">
              الطبيب:{" "}
              <span className="font-semibold text-slate-100">
                {displayName}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex itemscenter gap-2"
          >
            <div className="h-10 w-10 rounded-full bg-emerald-500 text-slate-900 grid place-items-center text-xs font-extrabold ring-2 ring-emerald-400/70 shadow-[0_0_18px_rgba(16,185,129,0.8)]">
              DR
            </div>
          </button>
        </header>

        {/* ✅ زودنا padding-bottom عشان لو فيه شريط سفلي من AppShell ما يغطي آخر الصفحة */}
        <main className="flex-1 relative pb-24">
          <div className="p-2 sm:p-4">
            <div className="grid gap-3 sm:gap-4 md:grid-cols-[minmax(0,1.8fr)_minmax(0,3fr)_minmax(0,1.6fr)]">
              {/* قائمة الانتظار */}
              <section className="relative rounded-2xl border border-emerald-500/50 bg-slate-900/95 flex flex-col overflow-hidden">
                <header className="px-4 py-2 border-b border-slate-800 bg-slate-950/80 text-[11px] sm:text-xs">
                  <div className="font-semibold text-slate-100">
                    المرضى في قائمة الانتظار
                  </div>
                  <div className="text-slate-400">
                    سيتم ربط المرضى بطابور الاستشارات لاحقًا
                  </div>
                </header>

                <div className="px-4 py-3 border-b border-slate-800 flex items-baseline justify-between text-[11px] sm:text-xs">
                  <div className="text-slate-300">
                    عدد المرضى الذين ينتظرون دورهم الآن
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                    {waitingCount}
                  </div>
                </div>

                <div className="max-h-[40vh] md:max-h-none flex-1 overflow-y-auto px-4 py-3 space-y-2 text-[11px] sm:text-xs text-slate-300">
                  {queueRows.length === 0 ? (
                    <div className="text-slate-500 text-center">
                      هنا ستظهر قائمة المرضى مثل قائمة المشاركين.
                    </div>
                  ) : (
                    queueRows.map((q) => {
                      const p = patientProfiles[q.patient_id];
                      const isActive = q.id === selectedQueueId;
                      const name =
                        (p?.full_name || p?.username || "").trim() ||
                        "مريض بدون اسم";
                      const statusLabel =
                        q.status === "waiting"
                          ? "ينتظر الدور"
                          : q.status === "called"
                          ? "تم استدعاؤه"
                          : q.status === "in_session"
                          ? "داخل الجلسة"
                          : q.status;

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => handleSelectPatient(q.id)}
                          className={[
                            "w-full text-right rounded-xl border px-3 py-2 flex flex-col gap-1 transition",
                            isActive
                              ? "border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
                              : "border-slate-800 bg-slate-900/80 hover:bg-slate-900",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-slate-50 truncate">
                              {name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {q.requested_at
                                ? new Date(q.requested_at).toLocaleTimeString(
                                    "ar-SA",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )
                                : ""}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                            <span>{statusLabel}</span>
                            <span>
                              {q.is_free
                                ? "مجاني"
                                : q.price
                                ? `${q.price} ${q.currency || "SAR"}`
                                : ""}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              {/* الوسط: البث + الشات */}
              <div className="flex flex-col gap-3 sm:gap-4">
                <section className="relative rounded-[24px] border border-emerald-500/70 bg-slate-900/95 shadow-[0_0_45px_rgba(16,185,129,0.4)] flex flex-col overflow-hidden">
                  <header className="px-4 py-2 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] sm:text-xs">
                    <div className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-semibold text-emerald-200">
                        بث مباشر للطبيب
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPrescription(true)}
                        disabled={!selectedRow}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 border border-slate-700 bg-slate-900 text-[10px] sm:text-xs hover:bg-slate-800 disabled:opacity-50"
                      >
                        <FileText className="h-3 w-3" />
                        <span>كتابة وصفة</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleEndSession}
                        disabled={!selectedRow}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 bg-red-600 text-[10px] sm:text-xs text-slate-50 hover:bg-red-500 disabled:opacity-50"
                      >
                        <PhoneOff className="h-3 w-3" />
                        <span>إنهاء الجلسة</span>
                      </button>
                    </div>
                  </header>

                  <div className="grid place-items-center px-4 py-3">
                    <div className="space-y-4 text-center">
                      <div className="mx-auto h-40 w-full max-w-md rounded-3xl border-2 border-emerald-400/70 bg-slate-800/80 grid place-items-center">
                        هنا تظهر صورة / فيديو الطبيب
                      </div>

                      {selectedRow && (
                        <div className="text-[11px] sm:text-xs text-slate-300 space-y-1">
                          <div>
                            المريض الحالي:{" "}
                            <span className="font-semibold text-slate-50">
                              {currentPatientBasicName || "مريض"}
                            </span>
                          </div>

                          {patientExtra?.age != null && (
                            <div className="text-slate-300">
                              العمر التقريبي:{" "}
                              <span className="font-semibold">
                                {patientExtra.age} سنة
                              </span>
                            </div>
                          )}

                          {mainComplaint && (
                            <div className="text-slate-300">
                              الشكوى الحالية:{" "}
                              <span className="font-semibold">
                                {mainComplaint}
                              </span>
                            </div>
                          )}

                          <div className="text-slate-400">
                            عند ربط نظام البث، سيتم إظهار تفاصيل الجلسة
                            والصوت/الفيديو هنا لنفس المريض المختار.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <ConsultationChat
                      queueId={selectedRow?.id ?? null}
                      role="doctor"
                      disabled={chatDisabled}
                    />
                  </div>
                </section>
              </div>

              {/* ملفات وبيانات المريض */}
              <section className="relative rounded-2xl border border-slate-700 bg-slate-900/95 flex flex-col overflow-hidden">
                <header className="px-4 py-2 border-b border-slate-800 bg-slate-950/80 text-[11px] sm:text-xs">
                  <div className="font-semibold text-slate-100">
                    ملفات وبيانات المريض
                  </div>
                </header>

                <div className="max-h-[60vh] md:max-h-none flex-1 overflow-y-auto px-4 py-3 text-[11px] sm:text-xs space-y-3">
                  {/* بيانات أساسية */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-1">
                    <div className="font-semibold text-slate-100 mb-1">
                      بيانات المريض الأساسية
                    </div>
                    {!selectedRow ? (
                      <div className="text-slate-500">
                        اختر مريضًا من قائمة الانتظار لعرض بياناته.
                      </div>
                    ) : (
                      <>
                        <div>
                          الاسم:{" "}
                          <span className="font-semibold text-slate-50">
                            {currentPatientBasicName || "مريض"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 break-all">
                          Patient ID: {selectedRow.patient_id}
                        </div>
                        {patientExtra?.age != null && (
                          <div>
                            العمر:{" "}
                            <span className="font-semibold">
                              {patientExtra.age} سنة
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* العلامات الحيوية */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-1">
                    <div className="font-semibold text-slate-100 mb-1">
                      آخر العلامات الحيوية
                    </div>

                    {!selectedRow && (
                      <div className="text-slate-500">
                        اختر مريضًا لعرض قياساته الحيوية.
                      </div>
                    )}

                    {selectedRow && vitalsLoading && (
                      <div className="text-slate-400">
                        جارٍ تحميل القياسات الحيوية…
                      </div>
                    )}

                    {selectedRow && vitalsErr && (
                      <div className="text-red-300">{vitalsErr}</div>
                    )}

                    {selectedRow &&
                      !vitalsLoading &&
                      !vitalsErr &&
                      vitals &&
                      vitals.length === 0 && (
                        <div className="text-slate-400">
                          لا توجد قياسات حيوية مسجّلة لهذا المريض.
                        </div>
                      )}

                    {selectedRow &&
                      !vitalsLoading &&
                      !vitalsErr &&
                      vitals &&
                      vitals.length > 0 && (
                        <ul className="space-y-1">
                          {vitals.slice(0, 8).map((v) => {
                            const mainValue =
                              v.value_text ??
                              (v.value_numeric != null
                                ? String(v.value_numeric)
                                : "");
                            const extraValue =
                              v.value2_numeric != null
                                ? ` / ${v.value2_numeric}`
                                : "";
                            return (
                              <li
                                key={v.id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/70 px-2 py-1"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="truncate">
                                    {v.vital_type}: {mainValue}
                                    {extraValue} {v.unit ? v.unit : ""}
                                  </div>
                                  {v.recorded_at && (
                                    <div className="text-[10px] text-slate-500">
                                      {new Date(v.recorded_at).toLocaleString(
                                        "ar-SA",
                                        { hour: "2-digit", minute: "2-digit" }
                                      )}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                  </div>

                  {/* الملفات الطبية */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-1">
                    <div className="font-semibold text-slate-100 mb-1">
                      الملفات الطبية المرفوعة
                    </div>

                    {!selectedRow && (
                      <div className="text-slate-500">
                        اختر مريضًا لعرض ملفاته الطبية.
                      </div>
                    )}

                    {selectedRow && filesLoading && (
                      <div className="text-slate-400">
                        جارٍ تحميل ملفات المريض…
                      </div>
                    )}

                    {selectedRow && filesErr && (
                      <div className="text-red-300">{filesErr}</div>
                    )}

                    {selectedRow &&
                      !filesLoading &&
                      !filesErr &&
                      patientFiles &&
                      patientFiles.length === 0 && (
                        <div className="text-slate-400">
                          لا توجد ملفات طبية مسجّلة لهذا المريض حتى الآن.
                        </div>
                      )}

                    {selectedRow &&
                      !filesLoading &&
                      !filesErr &&
                      patientFiles &&
                      patientFiles.length > 0 && (
                        <ul className="space-y-1">
                          {patientFiles.slice(0, 20).map((f) => {
                            const name =
                              f.storage_path.split("/").pop() || f.storage_path;
                            return (
                              <li
                                key={f.id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/70 px-2 py-1"
                              >
                                <div className="flex-1 min-w-0">
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
                                    className="shrink-0 text-[10px] font-semibold text-sky-400 hover:text-sky-200"
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
                </div>
              </section>
            </div>
          </div>
        </main>

        {showPrescription && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-100 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  <span>وصفة طبية</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrescription(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  إغلاق
                </button>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <div>
                  المريض:{" "}
                  <span className="font-semibold text-slate-50">
                    {currentPatientBasicName || "—"}
                  </span>
                </div>
                {patientExtra?.age != null && (
                  <div>
                    العمر:{" "}
                    <span className="font-semibold">
                      {patientExtra.age} سنة
                    </span>
                  </div>
                )}
                <div className="text-[11px] text-slate-500">
                  عند الضغط على "حفظ الوصفة" سيتم إرسالها كنص داخل الشات.
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">
                  نص الوصفة / العلاج
                </label>
                <textarea
                  rows={6}
                  value={prescriptionText}
                  onChange={(e) => setPrescriptionText(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none resize-none"
                  placeholder={
                    "مثال:\nأموكسيسيللين 500 ملغ كل 8 ساعات لمدة 5 أيام..."
                  }
                />
              </div>

              {prescriptionErr && (
                <div className="text-[11px] text-red-300">
                  {prescriptionErr}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="text-[10px] text-slate-500">
                  سيتم إرسالها كنص داخل <code>consultation_messages</code>.
                </div>
                <button
                  type="button"
                  onClick={() => void handleSavePrescription()}
                  disabled={prescriptionSaving}
                  className="rounded-full px-4 py-1.5 bg-emerald-500 text-xs font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {prescriptionSaving ? "جاري الحفظ…" : "حفظ الوصفة في الشات"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
