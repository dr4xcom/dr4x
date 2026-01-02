// src/app/patient/consultations/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageCircle,
  Activity,
  User,
  Stethoscope,
} from "lucide-react";

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

type VitalRow = {
  id: string;
  patient_id: string;
  vital_type: string | null;
  value_numeric: number | null;
  value2_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  recorded_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  specialty: string | null; // لو غير موجود في الجدول سيأتي null ولا يكسر شيء
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

function badgeClass(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (!s) return "border-slate-800 bg-slate-950/40 text-slate-200";
  if (["done", "completed", "closed", "resolved", "finished"].includes(s))
    return "border-emerald-900/50 bg-emerald-950/40 text-emerald-200";
  if (["pending", "waiting", "queued", "in_queue", "new"].includes(s))
    return "border-amber-900/50 bg-amber-950/40 text-amber-200";
  if (["accepted", "called", "started", "active", "in_progress"].includes(s))
    return "border-sky-900/50 bg-sky-950/40 text-sky-200";
  if (["cancelled", "canceled", "rejected", "failed"].includes(s))
    return "border-red-900/50 bg-red-950/40 text-red-200";
  return "border-slate-800 bg-slate-950/40 text-slate-200";
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

export default function PatientConsultationRoomPage() {
  const router = useRouter();
  const params = useParams();

  const rawId = useMemo(() => {
    const v = (params?.id as string) ?? "";
    return String(v).trim();
  }, [params]);

  const isValidId = useMemo(() => {
    if (!rawId) return false;
    return /^\d+$/.test(rawId);
  }, [rawId]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [meId, setMeId] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<ConsultationRow | null>(
    null
  );
  const [doctorProfile, setDoctorProfile] = useState<ProfileRow | null>(null);
  const [vitals, setVitals] = useState<VitalRow[]>([]);

  // أزرار تحكم للمريض (واجهة فقط – ما تلمس الـ DB)
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        if (!isValidId) {
          setErrorMsg("معرّف الاستشارة غير صحيح.");
          setLoading(false);
          return;
        }

        // 1) المستخدم الحالي (لازم يكون مريض هذه الاستشارة)
        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const uid = uRes?.user?.id ?? null;

        if (!uid) {
          router.push("/auth/login");
          return;
        }

        if (!alive) return;
        setMeId(uid);

        // 2) جلب الاستشارة والتأكد أن patient_id = uid
        const { data: cRow, error: cErr } = await supabase
          .from("consultations")
          .select(
            "id,patient_id,doctor_id,scheduled_time,status,session_link,price,created_at"
          )
          .eq("id", rawId)
          .maybeSingle();

        if (cErr) throw cErr;
        if (!alive) return;

        if (!cRow) {
          setConsultation(null);
          setErrorMsg("لم يتم العثور على الاستشارة.");
          setLoading(false);
          return;
        }

        const c = cRow as ConsultationRow;

        if (!c.patient_id || c.patient_id !== uid) {
          setConsultation(null);
          setErrorMsg("هذه الاستشارة ليست مرتبطة بحسابك.");
          setLoading(false);
          return;
        }

        setConsultation(c);

        // 3) بروفايل الطبيب من جدول profiles (أو جدول الأطباء لو تحب مستقبلاً)
        if (c.doctor_id) {
          const { data: dRow, error: dErr } = await supabase
            .from("profiles")
            .select("id, full_name, username, email, specialty")
            .eq("id", c.doctor_id)
            .maybeSingle();

          if (dErr) {
            console.error("doctor profile error", dErr);
          } else {
            setDoctorProfile((dRow ?? null) as ProfileRow | null);
          }
        } else {
          setDoctorProfile(null);
        }

        // 4) العلامات الحيوية لهذا المريض (نفس جدول patient_vitals)
        const { data: vRows, error: vErr } = await supabase
          .from("patient_vitals")
          .select(
            "id, patient_id, vital_type, value_numeric, value2_numeric, value_text, unit, recorded_at"
          )
          .eq("patient_id", uid)
          .order("recorded_at", { ascending: false })
          .limit(20);

        if (vErr) {
          console.error("vitals error", vErr);
        } else {
          setVitals((vRows ?? []) as VitalRow[]);
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error(e);
        setErrorMsg(
          e?.message ??
            "تعذر تحميل غرفة الكشف للمريض. قد تكون هناك مشكلة في الصلاحيات أو الاتصال."
        );
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [rawId, isValidId, router]);

  // آخر قراءة لكل نوع
  const vitalsMap = useMemo(() => {
    const map: Record<string, VitalRow> = {};
    for (const v of vitals) {
      const key = (v.vital_type ?? "other").toLowerCase();
      if (!map[key]) {
        map[key] = v;
      }
    }
    return map;
  }, [vitals]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Patient · Room</div>
          <h2 className="text-lg font-extrabold">غرفة الكشف للمريض</h2>
          <div className="text-sm text-slate-300">
            هنا تتابع استشارتك مع الطبيب: بث مباشر + شات + بيانات الطبيب +
            علامتك الحيوية.
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/40"
        >
          رجوع
        </button>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {errorMsg}
        </div>
      ) : null}

      {consultation ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400">
              الاستشارة #{String(consultation.id)}
            </span>
            <span
              className={[
                "text-xs font-bold rounded-full px-2 py-1 border",
                badgeClass(consultation.status),
              ].join(" ")}
            >
              {safeText(consultation.status)}
            </span>

            {consultation.scheduled_time ? (
              <span className="text-xs text-slate-400">
                الموعد: {formatTime(consultation.scheduled_time)}
              </span>
            ) : null}

            {consultation.price != null ? (
              <span className="text-xs text-slate-400">
                الرسوم: {consultation.price} ريال
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          جارٍ تحميل البيانات…
        </div>
      )}

      {/* Main layout */}
      {!loading && consultation && (
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          {/* ===== اليسار: فيديو + شات للمريض ===== */}
          <div className="space-y-4">
            {/* Video area (نفس مكان رقم 4 في الصورة) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm font-semibold">
                    شاشة البث مع الطبيب
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="relative w-full aspect-video rounded-xl bg-black/80 border border-slate-800 flex items-center justify-center text-slate-400 text-sm">
                  {consultation.session_link?.trim() ? (
                    <span>
                      سيتم وضع مشغل البث هنا (نفس الجلسة التي يستخدمها الطبيب)
                      باستخدام{" "}
                      <span className="text-sky-300 font-semibold">
                        session_link
                      </span>{" "}
                      لاحقًا.
                    </span>
                  ) : (
                    <span>
                      لم يبدأ البث بعد، انتظر حتى يدخل الطبيب أو يتم إرسال رابط
                      الجلسة.
                    </span>
                  )}
                </div>

                {/* أزرار تحكم للمريض (واجهة فقط) */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMicOn((v) => !v)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border",
                      micOn
                        ? "border-emerald-400 text-emerald-200"
                        : "border-slate-500 text-slate-200",
                    ].join(" ")}
                  >
                    {micOn ? (
                      <Mic className="h-4 w-4" />
                    ) : (
                      <MicOff className="h-4 w-4" />
                    )}
                    <span>
                      {micOn ? "إيقاف الميكروفون" : "تشغيل الميكروفون"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCamOn((v) => !v)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border",
                      camOn
                        ? "border-sky-400 text-sky-200"
                        : "border-slate-500 text-slate-200",
                    ].join(" ")}
                  >
                    {camOn ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <VideoOff className="h-4 w-4" />
                    )}
                    <span>{camOn ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Chat area (مكان رقم 2 في الصورة) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-sky-300" />
                  <span className="text-sm font-semibold">
                    المحادثة مع الطبيب
                  </span>
                </div>
              </div>

              <div className="p-4 text-sm text-slate-300 space-y-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                  سيتم ربط هذه المنطقة لاحقًا بنظام الرسائل بينك وبين الطبيب (من
                  نفس جداول الرسائل الموجودة في النظام) بدون إنشاء جداول جديدة.
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    مؤقتًا يمكنك فتح صفحة الرسائل العامة للتواصل مع الطبيب.
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push("/messages")}
                    className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-400"
                  >
                    فتح الرسائل
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ===== اليمين: معلومات الطبيب + العلامات الحيوية + زر تحديث ===== */}
          <div className="space-y-4">
            {/* معلومات الطبيب (الصورة الكبيرة + النبذة في المستقبل) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Stethoscope className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-semibold">الطبيب المعالج</span>
              </div>

              {doctorProfile ? (
                <div className="space-y-1 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500">الاسم:</span>{" "}
                    <span className="font-semibold">
                      {safeText(doctorProfile.full_name)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">التخصص:</span>{" "}
                    <span className="font-semibold">
                      {safeText(doctorProfile.specialty)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">اسم المستخدم:</span>{" "}
                    <span className="font-semibold">
                      {safeText(doctorProfile.username)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  لا توجد بيانات طبيب مرتبطة بهذه الاستشارة.
                </div>
              )}

              <div className="mt-2 text-[11px] text-slate-500">
                ستظهر هنا مستقبلاً نبذة الطبيب التي كتبها في ملفه عند التسجيل
                (bio / description) بدون الحاجة لأي جداول إضافية.
              </div>
            </div>

            {/* العلامات الحيوية (نفس ما يراه الطبيب) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-rose-300" />
                  <span className="text-sm font-semibold">
                    آخر العلامات الحيوية التي أرسلتها
                  </span>
                </div>
              </div>

              {Object.keys(vitalsMap).length === 0 ? (
                <div className="text-xs text-slate-400">
                  لم ترسل أي قياسات حتى الآن. استخدم زر{" "}
                  <span className="font-semibold">تحديث العلامات الحيوية</span>{" "}
                  بالأسفل لإدخال قياساتك.
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-200">
                  {/* الحرارة */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">الحرارة (°C)</span>
                      <span className="text-slate-400">
                        {formatTime(
                          vitalsMap["temperature"]?.recorded_at ?? null
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-extrabold">
                      {vitalsMap["temperature"]
                        ? `${vitalsMap["temperature"].value_numeric ?? "—"} ${
                            vitalsMap["temperature"].unit ?? ""
                          }`
                        : "لا يوجد قياس"}
                    </div>
                  </div>

                  {/* ضغط الدم */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">ضغط الدم (mmHg)</span>
                      <span className="text-slate-400">
                        {formatTime(
                          vitalsMap["blood_pressure"]?.recorded_at ?? null
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-extrabold">
                      {vitalsMap["blood_pressure"]
                        ? `${vitalsMap["blood_pressure"].value_numeric ?? "—"} / ${
                            vitalsMap["blood_pressure"].value2_numeric ?? "—"
                          } ${vitalsMap["blood_pressure"].unit ?? ""}`
                        : "لا يوجد قياس"}
                    </div>
                  </div>

                  {/* الوزن */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">الوزن (kg)</span>
                      <span className="text-slate-400">
                        {formatTime(vitalsMap["weight"]?.recorded_at ?? null)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-extrabold">
                      {vitalsMap["weight"]
                        ? `${vitalsMap["weight"].value_numeric ?? "—"} ${
                            vitalsMap["weight"].unit ?? ""
                          }`
                        : "لا يوجد قياس"}
                    </div>
                  </div>

                  {/* الطول */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">الطول (cm)</span>
                      <span className="text-slate-400">
                        {formatTime(vitalsMap["height"]?.recorded_at ?? null)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-extrabold">
                      {vitalsMap["height"]
                        ? `${vitalsMap["height"].value_numeric ?? "—"} ${
                            vitalsMap["height"].unit ?? ""
                          }`
                        : "لا يوجد قياس"}
                    </div>
                  </div>

                  {/* السكر */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        قياس السكر (mg/dL)
                      </span>
                      <span className="text-slate-400">
                        {formatTime(
                          vitalsMap["glucose"]?.recorded_at ?? null
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-extrabold">
                      {vitalsMap["glucose"]
                        ? `${vitalsMap["glucose"].value_numeric ?? "—"} ${
                            vitalsMap["glucose"].unit ?? ""
                          }`
                        : "لا يوجد قياس"}
                    </div>
                  </div>
                </div>
              )}

              {/* زر يفتح صفحة العلامات الحيوية التي أرسلتها لي فوق */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/patient/vitals?consultation_id=${encodeURIComponent(
                        rawId
                      )}`
                    )
                  }
                  className="w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-emerald-400"
                >
                  تحديث العلامات الحيوية
                </button>
              </div>
            </div>

            {/* ملاحظة صغيرة عن الخصوصية */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 leading-5">
              لا تظهر للطبيب أي معلومات أخرى عن حسابك إلا ما تسمح به سياسات
              النظام (مثل الاسم، التخصص، ونتائج التحاليل التي تقرر أنت إرسالها).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
