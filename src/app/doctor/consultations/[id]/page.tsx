// src/app/doctor/consultations/[id]/page.tsx
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
  AlertTriangle,
} from "lucide-react";

import PatientVitalsPanel from "@/components/clinic/PatientVitalsPanel";
import PatientFilesPanel from "@/components/clinic/PatientFilesPanel";

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

type RoomSettings = {
  enabled: boolean;
  chatEnabled: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  vitalsEnabled: boolean;
  filesEnabled: boolean;
  safetyEnabled: boolean;
  safetyImageUrl: string | null;
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
  if (["cancelled", "canceled", "rejected", "failed"].includes(s))
    return "border-red-900/50 bg-red-950/40 text-red-200";
  if (["accepted", "called", "started", "active", "in_progress"].includes(s))
    return "border-sky-900/50 bg-sky-950/40 text-sky-200";
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

export default function DoctorConsultationRoomPage() {
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
  const [consultation, setConsultation] = useState<ConsultationRow | null>(null);
  const [patientProfile, setPatientProfile] = useState<ProfileRow | null>(null);

  const [roomSettings, setRoomSettings] = useState<RoomSettings>({
    enabled: true,
    chatEnabled: true,
    audioEnabled: true,
    videoEnabled: true,
    vitalsEnabled: true,
    filesEnabled: true,
    safetyEnabled: true,
    safetyImageUrl: null,
  });

  // أزرار التحكم المحلية (واجهة فقط حالياً)
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

        // 1) المستخدم الحالي
        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const uid = uRes?.user?.id ?? null;
        if (!alive) return;
        setMeId(uid);

        // 2) جلب الاستشارة
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

        // (اختياري) تأكد أن الطبيب الحالي هو صاحب الاستشارة
        if (uid && c.doctor_id && c.doctor_id !== uid) {
          setConsultation(null);
          setErrorMsg("لا تملك صلاحية لعرض هذه الاستشارة.");
          setLoading(false);
          return;
        }

        setConsultation(c);

        // 3) إعدادات غرفة الكشف من system_settings_kv (قراءة فقط)
        const settingKeys = [
          "dr_room_enabled",
          "dr_room_chat_enabled",
          "dr_room_audio_enabled",
          "dr_room_video_enabled",
          "dr_room_vitals_enabled",
          "dr_room_files_enabled",
          "dr_room_safety_enabled",
          "dr_room_safety_image_url",
        ];

        const { data: sRows, error: sErr } = await supabase
          .from("system_settings_kv")
          .select("key, value")
          .in("key", settingKeys);

        if (sErr) {
          console.error("room settings error", sErr);
        }

        if (!alive) return;

        const map: Record<string, string | null> = {};
        (sRows ?? []).forEach((r: any) => {
          map[r.key] = r.value as string | null;
        });

        const boolFrom = (k: string, def: boolean) => {
          const v = (map[k] ?? "").trim().toLowerCase();
          if (v === "true") return true;
          if (v === "false") return false;
          return def;
        };

        setRoomSettings({
          enabled: boolFrom("dr_room_enabled", true),
          chatEnabled: boolFrom("dr_room_chat_enabled", true),
          audioEnabled: boolFrom("dr_room_audio_enabled", true),
          videoEnabled: boolFrom("dr_room_video_enabled", true),
          vitalsEnabled: boolFrom("dr_room_vitals_enabled", true),
          filesEnabled: boolFrom("dr_room_files_enabled", true),
          safetyEnabled: boolFrom("dr_room_safety_enabled", true),
          safetyImageUrl: map["dr_room_safety_image_url"] ?? null,
        });

        // 4) بروفايل المريض (من جدول profiles)
        if (c.patient_id) {
          const { data: pRow, error: pErr } = await supabase
            .from("profiles")
            .select("id, full_name, username, email")
            .eq("id", c.patient_id)
            .maybeSingle();

          if (pErr) {
            console.error("patient profile error", pErr);
          } else {
            setPatientProfile((pRow ?? null) as ProfileRow | null);
          }
        } else {
          setPatientProfile(null);
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error(e);
        setErrorMsg(
          e?.message ??
            "تعذر تحميل غرفة الكشف. قد تكون هناك مشكلة في الصلاحيات أو الاتصال."
        );
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [rawId, isValidId]);

  const roomDisabled = !roomSettings.enabled;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Doctor · Room</div>
          <h2 className="text-lg font-extrabold">غرفة الكشف</h2>
          <div className="text-sm text-slate-300">
            بث مباشر + شات + بيانات المريض + العلامات الحيوية + الملفات (قراءة فقط من الجداول الموجودة).
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/40"
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

          {roomDisabled && (
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <span>
                غرفة الكشف معطّلة من لوحة تحكم المدير العام (system_settings_kv).
              </span>
            </div>
          )}
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
          {/* ===== اليسار: البث + الشات ===== */}
          <div className="space-y-4">
            {/* Video / Audio area */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm font-semibold">البث المباشر</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>الطبيب:</span>
                  <span className="font-semibold break-all">
                    {safeText(consultation.doctor_id)}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="relative w-full aspect-video rounded-xl bg-black/80 border border-slate-800 flex items-center justify-center text-slate-400 text-sm">
                  {roomDisabled || !roomSettings.videoEnabled ? (
                    <span>البث بالفيديو مغلق من لوحة التحكم.</span>
                  ) : consultation.session_link?.trim() ? (
                    <span>
                      هنا سيتم وضع مشغل البث (WebRTC / Zoom) باستخدام{" "}
                      <span className="text-sky-300 font-semibold">
                        session_link
                      </span>{" "}
                      لاحقًا.
                    </span>
                  ) : (
                    <span>
                      لم يتم تحديد رابط جلسة بعد (session_link فارغ في
                      consultations).
                    </span>
                  )}
                </div>

                {/* Controls (واجهة فقط حالياً) */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={roomDisabled || !roomSettings.audioEnabled}
                    onClick={() => setMicOn((v) => !v)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border",
                      roomDisabled || !roomSettings.audioEnabled
                        ? "border-slate-700 text-slate-500 cursor-not-allowed"
                        : micOn
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
                    disabled={roomDisabled || !roomSettings.videoEnabled}
                    onClick={() => setCamOn((v) => !v)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border",
                      roomDisabled || !roomSettings.videoEnabled
                        ? "border-slate-700 text-slate-500 cursor-not-allowed"
                        : camOn
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

            {/* Chat area (placeholder يستخدم نظام الرسائل الحالي لاحقاً) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-sky-300" />
                  <span className="text-sm font-semibold">
                    المحادثة بين الطبيب والمريض
                  </span>
                </div>
                {!roomSettings.chatEnabled && (
                  <span className="text-xs text-amber-300">
                    تم تعطيل الشات من لوحة التحكم.
                  </span>
                )}
              </div>

              <div className="p-4 text-sm text-slate-300">
                {roomDisabled ? (
                  <div>غرفة الكشف معطّلة بالكامل، الشات غير متاح.</div>
                ) : !roomSettings.chatEnabled ? (
                  <div>الشات مغلق حاليًا بقرار المدير العام.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                      هنا مستقبلاً نربط **نظام DM الموجود عندك** (الجداول:
                      dm_conversations / dm_messages) ليكون شات مباشر داخل غرفة
                      الكشف، بدون إنشاء جداول جديدة.
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">
                        حالياً تقدر تفتح صفحة الرسائل الرئيسية وتستخدمها للدردشة
                        مع المريض.
                      </span>
                      <button
                        type="button"
                        onClick={() => router.push("/messages")}
                        className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-400"
                      >
                        فتح صفحة الرسائل
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== اليمين: بيانات المريض + العلامات الحيوية + الملفات + السيفتي ===== */}
          <div className="space-y-4">
            {/* كرت بيانات المريض */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-semibold">بيانات المريض</span>
              </div>

              {patientProfile ? (
                <div className="space-y-1 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500">الاسم:</span>{" "}
                    <span className="font-semibold">
                      {safeText(patientProfile.full_name)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">اسم المستخدم:</span>{" "}
                    <span className="font-semibold">
                      {safeText(patientProfile.username)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">البريد:</span>{" "}
                    <span className="font-semibold">
                      {safeText(patientProfile.email)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/patient/profile")}
                    className="mt-2 rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
                  >
                    فتح ملف المريض (صفحة patient/profile)
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  لا توجد بيانات بروفايل مريض مرتبطة بهذه الاستشارة (patient_id
                  فارغ).
                </div>
              )}
            </div>

            {/* العلامات الحيوية (مربع 3 - جزء أول) */}
            {roomSettings.vitalsEnabled &&
              consultation.patient_id && (
                <PatientVitalsPanel
                  patientId={consultation.patient_id}
                  disabled={roomDisabled}
                />
              )}

            {/* ملفات المريض (مربع 3 - جزء ثاني) */}
            {roomSettings.filesEnabled &&
              consultation.patient_id && (
                <PatientFilesPanel
                  patientId={consultation.patient_id}
                  consultationId={consultation.id}
                  disabled={roomDisabled}
                />
              )}

            {/* صورة السيفتي */}
            {roomSettings.safetyEnabled && roomSettings.safetyImageUrl && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-800 text-xs text-slate-400">
                  لوحة تنبيه (سيفتي) – يمكن تغيير الصورة من لوحة التحكم.
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={roomSettings.safetyImageUrl}
                  alt="Safety"
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
