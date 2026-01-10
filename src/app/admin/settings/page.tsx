// src/app/admin/settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  DEFAULT_FLAGS,
  FeatureFlags,
  getFeatureFlags,
  setFeatureFlag,
  getSystemSettingBool,
  getSystemSettingNumber,
  getSystemSettingString,
  setSystemSettingRaw,
} from "@/utils/systemSettings";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-7 w-12 items-center rounded-full transition",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        checked ? "bg-emerald-500" : "bg-slate-600",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // إعدادات عامة للموقع
  const [siteName, setSiteName] = useState("DR4X");
  const [siteLogoUrl, setSiteLogoUrl] = useState("/dr4x-logo.png");

  // إعدادات غرفة الكشف (من system_settings_kv)
  const [roomEnabled, setRoomEnabled] = useState(true);
  const [roomChatEnabled, setRoomChatEnabled] = useState(true);
  const [roomAudioEnabled, setRoomAudioEnabled] = useState(true);
  const [roomVideoEnabled, setRoomVideoEnabled] = useState(true);
  const [roomVitalsEnabled, setRoomVitalsEnabled] = useState(true);
  const [roomSafetyEnabled, setRoomSafetyEnabled] = useState(true);
  const [roomSafetyImageUrl, setRoomSafetyImageUrl] = useState("");

  // ✅ جديد: التحكم في رفع الملفات (صور / PDF) أثناء الجلسة
  const [filesEnabled, setFilesEnabled] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1) Feature flags
        const f = await getFeatureFlags();
        if (!alive) return;
        setFlags(f);

        // 2) إعدادات عامة
        const [name, logo] = await Promise.all([
          getSystemSettingString("site_name", "DR4X"),
          getSystemSettingString("site_logo_url", "/dr4x-logo.png"),
        ]);
        if (!alive) return;

        setSiteName((name || "DR4X").trim() || "DR4X");
        setSiteLogoUrl((logo || "/dr4x-logo.png").trim());

        // 3) إعدادات غرفة الكشف
        const [
          vEnabled,
          vChat,
          vAudio,
          vVideo,
          vVitals,
          vSafety,
          vSafetyImg,
          liveFilesFlag, // ✅ جديد
        ] = await Promise.all([
          getSystemSettingBool("dr_room_enabled", true),
          getSystemSettingBool("dr_room_chat_enabled", true),
          getSystemSettingBool("dr_room_audio_enabled", true),
          getSystemSettingBool("dr_room_video_enabled", true),
          getSystemSettingBool("dr_room_vitals_enabled", true),
          getSystemSettingBool("dr_room_safety_enabled", true),
          getSystemSettingString("dr_room_safety_image_url", ""),
          getSystemSettingBool("live_files_enabled", true), // ✅ جديد
        ]);

        if (!alive) return;

        setRoomEnabled(vEnabled ?? true);
        setRoomChatEnabled(vChat ?? true);
        setRoomAudioEnabled(vAudio ?? true);
        setRoomVideoEnabled(vVideo ?? true);
        setRoomVitalsEnabled(vVitals ?? true);
        setRoomSafetyEnabled(vSafety ?? true);
        setRoomSafetyImageUrl((vSafetyImg || "").trim());

        setFilesEnabled(liveFilesFlag ?? true); // ✅ جديد
      } catch (e: any) {
        if (!alive) return;

        setErrorMsg(
          e?.message ?? "تعذر تحميل الإعدادات. قد تكون مشكلة في الصلاحيات."
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function saveAll() {
    try {
      setSaveState("saving");
      setErrorMsg(null);

      // 1) حفظ الـ Feature flags
      await Promise.all(
        Object.entries(flags).map(([k, v]) =>
          setFeatureFlag(k as keyof FeatureFlags, v)
        )
      );

      // 2) حفظ إعدادات عامة
      await Promise.all([
        setSystemSettingRaw("site_name", siteName.trim() || "DR4X"),
        setSystemSettingRaw(
          "site_logo_url",
          siteLogoUrl.trim() || "/dr4x-logo.png"
        ),
      ]);

      // 3) حفظ إعدادات غرفة الكشف + رفع الملفات
      await Promise.all([
        setSystemSettingRaw("dr_room_enabled", roomEnabled ? "true" : "false"),
        setSystemSettingRaw(
          "dr_room_chat_enabled",
          roomChatEnabled ? "true" : "false"
        ),
        setSystemSettingRaw(
          "dr_room_audio_enabled",
          roomAudioEnabled ? "true" : "false"
        ),
        setSystemSettingRaw(
          "dr_room_video_enabled",
          roomVideoEnabled ? "true" : "false"
        ),
        setSystemSettingRaw(
          "dr_room_vitals_enabled",
          roomVitalsEnabled ? "true" : "false"
        ),
        setSystemSettingRaw(
          "dr_room_safety_enabled",
          roomSafetyEnabled ? "true" : "false"
        ),
        setSystemSettingRaw(
          "dr_room_safety_image_url",
          roomSafetyImageUrl.trim()
        ),

        // ✅ جديد: المفتاح العام للتحكم في رفع الملفات في الجلسة
        setSystemSettingRaw(
          "live_files_enabled",
          filesEnabled ? "true" : "false"
        ),
      ]);

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e: any) {
      setErrorMsg(
        e?.message ??
          "تعذر حفظ الإعدادات. تحقق من RLS لجدول system_settings_kv."
      );
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Admin</div>
          <h1 className="text-xl font-extrabold text-slate-50">
            إعدادات النظام
          </h1>
          <p className="text-sm text-slate-400">
            تعديل إعدادات الموقع + التحكم في غرفة الكشف للطبيب (بدون إضافة أي
            جداول جديدة).
          </p>
        </div>

        <button
          type="button"
          onClick={saveAll}
          disabled={saveState === "saving" || loading}
          className={[
            "rounded-xl px-4 py-2 text-sm font-semibold",
            saveState === "saving"
              ? "bg-slate-700 text-slate-300 cursor-wait"
              : saveState === "saved"
              ? "bg-emerald-500 text-slate-950"
              : "bg-sky-500 text-slate-950 hover:bg-sky-400",
          ].join(" ")}
        >
          {saveState === "saving"
            ? "جارٍ الحفظ…"
            : saveState === "saved"
            ? "تم الحفظ"
            : "حفظ الإعدادات"}
        </button>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {errorMsg}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          جارٍ تحميل الإعدادات…
        </div>
      ) : null}

      {/* إعدادات عامة للموقع */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-100 mb-1">
          إعدادات عامة للموقع
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">اسم الموقع</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
              placeholder="مثال: DR4X"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">رابط شعار الموقع</label>
            <input
              type="text"
              value={siteLogoUrl}
              onChange={(e) => setSiteLogoUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
              placeholder="/dr4x-logo.png أو رابط كامل"
            />
            <p className="text-[11px] text-slate-500">
              يستخدم في أعلى لوحة التحكم وفي الواجهة الأمامية.
            </p>
          </div>
        </div>
      </section>

      {/* إعدادات غرفة الكشف */}
      <section className="rounded-2xl border border-emerald-900/70 bg-slate-950/60 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-emerald-200 mb-1">
          إعدادات غرفة الكشف (Doctor Consultation Room)
        </h2>

        <p className="text-xs text-slate-400 mb-2">
          هذه الإعدادات تتحكم في صفحة{" "}
          <code className="text-[11px] bg-slate-900 px-1.5 py-0.5 rounded">
            /doctor/consultations/[id]
          </code>{" "}
          بدون أي تعديل على الجداول. الكود يقرأ القيم من{" "}
          <code className="text-[11px] bg-slate-900 px-1.5 py-0.5 rounded ms-1">
            system_settings_kv
          </code>{" "}
          .
        </p>

        {/* تفعيل/تعطيل الغرفة كاملة */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              تفعيل غرفة الكشف
            </div>
            <div className="text-xs text-slate-400">
              إذا تم إيقافها، تظهر رسالة للطبيب أن الغرفة معطلة ولا يمكن استخدام
              البث أو الشات.
            </div>
          </div>
          <Toggle checked={roomEnabled} onChange={setRoomEnabled} disabled={loading} />
        </div>

        {/* الصوت + الفيديو + الشات + رفع الملفات */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">
                السماح بالصوت
              </div>
              <div className="text-xs text-slate-400">
                يتحكم في أزرار تشغيل/إيقاف الميكروفون في غرفة الكشف.
              </div>
            </div>
            <Toggle
              checked={roomAudioEnabled}
              onChange={setRoomAudioEnabled}
              disabled={loading || !roomEnabled}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">
                السماح بالفيديو
              </div>
              <div className="text-xs text-slate-400">
                إذا تم إيقافه، تظهر رسالة أن البث بالفيديو مغلق.
              </div>
            </div>
            <Toggle
              checked={roomVideoEnabled}
              onChange={setRoomVideoEnabled}
              disabled={loading || !roomEnabled}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">
                تفعيل الشات
              </div>
              <div className="text-xs text-slate-400">
                إذا كان مغلقًا، يرى الطبيب والمريض رسالة أن المحادثة مغلقة من
                المدير العام.
              </div>
            </div>
            <Toggle
              checked={roomChatEnabled}
              onChange={setRoomChatEnabled}
              disabled={loading || !roomEnabled}
            />
          </div>

          {/* ✅ جديد: تفعيل رفع الملفات أثناء الجلسة */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">
                تفعيل رفع الملفات
              </div>
              <div className="text-xs text-slate-400">
                يتحكم في إمكانية رفع الملفات (صور / PDF) بين الطبيب والمريض داخل
                غرفة الكشف.
              </div>
            </div>
            <Toggle
              checked={filesEnabled}
              onChange={setFilesEnabled}
              disabled={loading || !roomEnabled}
            />
          </div>
        </div>

        {/* العلامات الحيوية */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              إظهار العلامات الحيوية
            </div>
            <div className="text-xs text-slate-400">
              التحكم في ظهور كرت{" "}
              <span className="text-rose-300">العلامات الحيوية</span> الذي يقرأ
              من جدول <code>patient_vitals</code>.
            </div>
          </div>
          <Toggle
            checked={roomVitalsEnabled}
            onChange={setRoomVitalsEnabled}
            disabled={loading || !roomEnabled}
          />
        </div>

        {/* لوحة السيفتي + صورة GIF أو غيرها */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">
                لوحة تنبيه (Safety Banner)
              </div>
              <div className="text-xs text-slate-400">
                يمكن استخدام صورة تنبيه (مثلاً GIF لإسعاف / شرطة) تظهر في يمين
                غرفة الكشف.
              </div>
            </div>
            <Toggle
              checked={roomSafetyEnabled}
              onChange={setRoomSafetyEnabled}
              disabled={loading || !roomEnabled}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[2fr_1fr] items-start">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                رابط صورة السيفتي (GIF / PNG / JPG)
              </label>
              <input
                type="text"
                value={roomSafetyImageUrl}
                onChange={(e) => setRoomSafetyImageUrl(e.target.value)}
                placeholder="مثال: https://.../safety.gif أو /storage/path.gif"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
              />
              <p className="text-[11px] text-slate-500">
                للتحكم في الوزن والحجم: تأكد أن الصورة ليست كبيرة جدًا (يفضل أقل
                من 500KB) حتى لا تبطئ التصفح.
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-400 mb-1">معاينة (إن وجدت)</div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2 flex items-center justify-center min-h-[80px]">
                {roomSafetyImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={roomSafetyImageUrl}
                    alt="Safety Preview"
                    className="max-h-24 max-w-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  <span className="text-[11px] text-slate-500">
                    لا يوجد رابط صورة حاليًا.
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setRoomSafetyImageUrl("")}
                className="w-full rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-[11px] font-semibold text-red-100 hover:bg-red-900/60"
              >
                حذف الصورة / عدم إظهارها
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
