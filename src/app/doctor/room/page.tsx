// src/app/doctor/room/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  Stethoscope,
  Activity,
  User,
  MessageCircle,
  Video,
  AlertTriangle,
} from "lucide-react";
import { getSystemSettingBool } from "@/utils/systemSettings";

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
};

type PatientVitalRow = {
  id: number;
  patient_id: string;
  recorded_by: string;
  vital_type: string;
  value_numeric: number | null;
  value2_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  recorded_at: string;
};

type VitalsByType = Record<string, PatientVitalRow[]>;

function formatDateTime(dt: string | null | undefined) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =============== لوحة العلامات الحيوية =============== */
function PatientVitalsPanel({ patientId }: { patientId: string }) {
  const [vitals, setVitals] = useState<PatientVitalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadVitals() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from("patient_vitals")
          .select(
            "id, patient_id, recorded_by, vital_type, value_numeric, value2_numeric, value_text, unit, recorded_at"
          )
          .eq("patient_id", patientId)
          .order("recorded_at", { ascending: false })
          .limit(50);

        if (!alive) return;

        if (error) {
          console.error("loadVitals error", error);
          setErrorMsg("تعذر تحميل العلامات الحيوية.");
          setVitals([]);
          return;
        }

        setVitals(data ?? []);
      } catch (e) {
        console.error("loadVitals exception", e);
        if (!alive) return;
        setErrorMsg("حدث خطأ أثناء تحميل العلامات الحيوية.");
        setVitals([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (patientId) {
      void loadVitals();
    } else {
      setLoading(false);
      setVitals([]);
    }

    return () => {
      alive = false;
    };
  }, [patientId]);

  const grouped: VitalsByType = useMemo(() => {
    const g: VitalsByType = {};
    for (const v of vitals) {
      const key = v.vital_type || "other";
      if (!g[key]) g[key] = [];
      g[key].push(v);
    }
    return g;
  }, [vitals]);

  function formatVitalValue(v: PatientVitalRow) {
    if (v.value_text && v.value_text.trim()) return v.value_text.trim();

    if (v.value2_numeric != null && v.value_numeric != null) {
      return `${v.value_numeric} / ${v.value2_numeric}${
        v.unit ? ` ${v.unit}` : ""
      }`;
    }

    if (v.value_numeric != null) {
      return `${v.value_numeric}${v.unit ? ` ${v.unit}` : ""}`;
    }

    return v.value_text?.trim() || "-";
  }

  return (
    <div className="dr4x-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            العلامات الحيوية
          </h2>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500">جاري تحميل العلامات الحيوية…</div>
      ) : errorMsg ? (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span>{errorMsg}</span>
        </div>
      ) : vitals.length === 0 ? (
        <div className="text-xs text-slate-500">
          لا توجد قياسات مسجلة لهذا المريض حتى الآن.
        </div>
      ) : (
        <div className="space-y-3 max-h-[280px] overflow-y-auto">
          {Object.entries(grouped).map(([type, rows]) => {
            const latest = rows[0];
            return (
              <div
                key={type}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-xs font-semibold text-slate-800">
                    {type}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    آخر تحديث: {formatDateTime(latest.recorded_at)}
                  </div>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {formatVitalValue(latest)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =============== بطاقة بيانات المريض =============== */
function PatientInfoPanel({ patientId }: { patientId: string }) {
  const [patient, setPatient] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadPatient() {
      if (!patientId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, username, email")
          .eq("id", patientId)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.error("loadPatient error", error);
          setPatient(null);
        } else {
          setPatient(data);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadPatient();

    return () => {
      alive = false;
    };
  }, [patientId]);

  const displayName = useMemo(() => {
    if (!patient) return "";
    return (
      patient.full_name?.trim() ||
      patient.username?.trim() ||
      (patient.email ? patient.email.split("@")[0] : "")
    );
  }, [patient]);

  const initials = useMemo(() => {
    const s = (displayName || "مريض").trim();
    return ((s[0] ?? "P") + (s[1] ?? "T")).toUpperCase();
  }, [displayName]);

  return (
    <div className="dr4x-card p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <User className="h-5 w-5 text-slate-700" />
        <h2 className="text-sm font-semibold text-slate-900">
          بيانات المريض
        </h2>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500">جاري تحميل بيانات المريض…</div>
      ) : !patient ? (
        <div className="text-xs text-slate-500">
          لم يتم العثور على بيانات للمريض.
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-bold">
            {initials}
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              {displayName || "مريض"}
            </div>
            {patient.username ? (
              <div className="text-xs text-slate-500">@{patient.username}</div>
            ) : null}
            {patient.email ? (
              <div className="text-xs text-slate-500">{patient.email}</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/* =============== صفحة غرفة الكشف (مع ارتباط لوحة التحكم) =============== */
export default function DoctorRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patient_id") || "";

  const [flagsLoading, setFlagsLoading] = useState(true);
  const [roomEnabled, setRoomEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [vitalsEnabled, setVitalsEnabled] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // ✅ نقرأ الإعدادات من system_settings_kv عبر الهيلبر الموجود
        const [room, chat, vitals] = await Promise.all([
          getSystemSettingBool("doctor_room_enabled", true),
          getSystemSettingBool("doctor_room_chat_enabled", true),
          getSystemSettingBool("doctor_room_vitals_enabled", true),
        ]);

        if (!alive) return;

        setRoomEnabled(!!room);
        setChatEnabled(!!chat);
        setVitalsEnabled(!!vitals);
      } catch (e) {
        console.error("DoctorRoomPage: settings error", e);
        if (!alive) return;

        // في حال فشل القراءة، نخليها شغّالة افتراضياً (ما نكسر الصفحة)
        setRoomEnabled(true);
        setChatEnabled(true);
        setVitalsEnabled(true);
      } finally {
        if (alive) setFlagsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const roomDisabled = !roomEnabled && !flagsLoading;

  return (
    <div className="min-h-screen bg-slate-50 py-4 px-2 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* عنوان أعلى الصفحة */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-slate-900" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              غرفة الكشف
            </h1>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 transition"
          >
            رجوع
          </button>
        </div>

        {/* حالة الإعدادات من لوحة التحكم */}
        {flagsLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            جاري تحميل إعدادات غرفة الكشف من لوحة التحكم…
          </div>
        )}

        {roomDisabled && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>
              غرفة الكشف معطّلة حاليًا من قِبل المدير العام عبر لوحة التحكم.
              يمكنك تفعيلها من إعدادات النظام (system_settings_kv) باستخدام
              المفتاح <code className="text-[11px] bg-white px-1 py-0.5 rounded">
                doctor_room_enabled
              </code>
              .
            </span>
          </div>
        )}

        {!patientId && !roomDisabled && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>
              لم يتم تمرير patient_id في الرابط. افتح الصفحة مثل:
              <br />
              <code className="text-[11px] bg-white px-2 py-1 rounded-lg border border-amber-200">
                /doctor/room?patient_id=UUID-OF-PATIENT
              </code>
            </span>
          </div>
        )}

        {/* الشبكة الرئيسية: تظهر فقط إذا الخاصية مفعلة */}
        {!roomDisabled && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
            {/* يسار: البث + الدردشة */}
            <div className="space-y-4">
              {/* منطقة البث المباشر (تظل موجودة دائماً ما دام roomEnabled=true) */}
              <div className="dr4x-card p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Video className="h-5 w-5 text-slate-700" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    بث مباشر بين الطبيب والمريض
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative aspect-video rounded-2xl bg-slate-900 text-slate-100 grid place-items-center text-xs sm:text-sm">
                    <span>فيديو الطبيب (سيتم ربطه لاحقًا بخدمة البث)</span>
                  </div>
                  <div className="relative aspect-video rounded-2xl bg-slate-800 text-slate-100 grid place-items-center text-xs sm:text-sm">
                    <span>فيديو المريض (سيتم ربطه لاحقًا بخدمة البث)</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed mt-2">
                  * حالياً هذه مجرد مساحات جاهزة للفيديو. لاحقاً يمكن ربطها
                  بخدمة WebRTC أو أي نظام بث تستخدمه في DR4X، مع استمرار تحكم
                  المدير العام عبر لوحة التحكّم.
                </p>
              </div>

              {/* الدردشة: تظهر فقط إذا chatEnabled = true */}
              {chatEnabled ? (
                <div className="dr4x-card p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageCircle className="h-5 w-5 text-slate-700" />
                    <h2 className="text-sm font-semibold text-slate-900">
                      الدردشة بين الطبيب والمريض
                    </h2>
                  </div>

                  <div className="h-40 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-500">
                    <span>
                      سيتم لاحقًا ربط هذه المنطقة بنظام الرسائل بين الطبيب والمريض
                      (نقرأ من جداول الرسائل الحالية بدون إضافة جداول جديدة).
                    </span>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      disabled
                      placeholder="حاليًا تجريبي – سيتم تفعيل الإرسال لاحقًا"
                      className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400 outline-none"
                    />
                    <button
                      type="button"
                      disabled
                      className="rounded-full bg-slate-300 text-white px-4 py-2 text-xs font-semibold cursor-not-allowed"
                    >
                      إرسال
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1">
                    * يمكن للمدير العام إيقاف هذه الدردشة من لوحة التحكم عبر
                    الإعداد{" "}
                    <code className="text-[11px] bg-slate-100 px-1 rounded">
                      doctor_room_chat_enabled
                    </code>
                    .
                  </p>
                </div>
              ) : (
                <div className="dr4x-card p-4 text-xs text-slate-500">
                  الدردشة في غرفة الكشف معطلة حاليًا من لوحة التحكم.
                </div>
              )}
            </div>

            {/* يمين: بطاقة المريض + العلامات الحيوية */}
            <div className="space-y-4">
              {patientId ? (
                <>
                  <PatientInfoPanel patientId={patientId} />

                  {vitalsEnabled ? (
                    <PatientVitalsPanel patientId={patientId} />
                  ) : (
                    <div className="dr4x-card p-4 text-xs text-slate-500">
                      عرض العلامات الحيوية للمريض في غرفة الكشف معطّل حاليًا من
                      لوحة التحكم (الإعداد{" "}
                      <code className="text-[11px] bg-slate-100 px-1 rounded">
                        doctor_room_vitals_enabled
                      </code>
                      ).
                    </div>
                  )}
                </>
              ) : (
                <div className="dr4x-card p-4 text-xs text-slate-500">
                  أدخل patient_id في الرابط لعرض بيانات المريض وعلاماته الحيوية.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
