// src/app/admin/doctor-room-settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type SaveState = "idle" | "saving" | "saved" | "error";

type RoomSettings = {
  enabled: boolean;
  chatEnabled: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  vitalsEnabled: boolean;
  safetyEnabled: boolean;
  safetyImageUrl: string;
};

const DEFAULT_SETTINGS: RoomSettings = {
  enabled: true,
  chatEnabled: true,
  audioEnabled: true,
  videoEnabled: true,
  vitalsEnabled: true,
  safetyEnabled: true,
  safetyImageUrl: "",
};

const KEYS = {
  enabled: "dr_room_enabled",
  chatEnabled: "dr_room_chat_enabled",
  audioEnabled: "dr_room_audio_enabled",
  videoEnabled: "dr_room_video_enabled",
  vitalsEnabled: "dr_room_vitals_enabled",
  safetyEnabled: "dr_room_safety_enabled",
  safetyImageUrl: "dr_room_safety_image_url",
};

function Toggle({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        {description ? (
          <div className="text-xs text-slate-500 mt-0.5">{description}</div>
        ) : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={[
          "relative inline-flex h-7 w-12 items-center rounded-full transition",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          value ? "bg-emerald-500" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            value ? "translate-x-5" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export default function DoctorRoomSettingsPage() {
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("system_settings_kv")
          .select("key, value")
          .in("key", Object.values(KEYS));

        if (error) {
          console.error("doctor room settings load error", error);
          setLoading(false);
          return;
        }

        if (!active) return;

        const map: Record<string, string | null> = {};
        (data ?? []).forEach((row: any) => {
          map[row.key] = row.value as string | null;
        });

        const boolFrom = (k: string, def: boolean) => {
          const v = (map[k] ?? "").trim().toLowerCase();
          if (v === "true") return true;
          if (v === "false") return false;
          return def;
        };

        setSettings({
          enabled: boolFrom(KEYS.enabled, true),
          chatEnabled: boolFrom(KEYS.chatEnabled, true),
          audioEnabled: boolFrom(KEYS.audioEnabled, true),
          videoEnabled: boolFrom(KEYS.videoEnabled, true),
          vitalsEnabled: boolFrom(KEYS.vitalsEnabled, true),
          safetyEnabled: boolFrom(KEYS.safetyEnabled, true),
          safetyImageUrl: (map[KEYS.safetyImageUrl] ?? "").trim(),
        });

        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function saveAll() {
    try {
      setSaveState("saving");

      const rows = [
        {
          key: KEYS.enabled,
          value: String(settings.enabled),
          group: "doctor_room",
          type: "bool",
        },
        {
          key: KEYS.chatEnabled,
          value: String(settings.chatEnabled),
          group: "doctor_room",
          type: "bool",
        },
        {
          key: KEYS.audioEnabled,
          value: String(settings.audioEnabled),
          group: "doctor_room",
          type: "bool",
        },
        {
          key: KEYS.videoEnabled,
          value: String(settings.videoEnabled),
          group: "doctor_room",
          type: "bool",
        },
        {
          key: KEYS.vitalsEnabled,
          value: String(settings.vitalsEnabled),
          group: "doctor_room",
          type: "bool",
        },
        {
          key: KEYS.safetyEnabled,
          value: String(settings.safetyEnabled),
          group: "doctor_room",
          type: "bool",
        },
        {
          key: KEYS.safetyImageUrl,
          value: settings.safetyImageUrl || "",
          group: "doctor_room",
          type: "string",
        },
      ];

      const { error } = await supabase
        .from("system_settings_kv")
        .upsert(rows, { onConflict: "key" });

      if (error) {
        console.error("doctor room settings save error", error);
        setSaveState("error");
        return;
      }

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      console.error(e);
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">
            إعدادات غرفة الكشف
          </h1>
          <p className="text-sm text-slate-500">
            تحكم كامل في البث، الشات، الصوت، الكاميرا، العلامات الحيوية، وصورة
            السيفتي – بدون إضافة جداول جديدة.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          جارٍ تحميل الإعدادات…
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <Toggle
            label="تفعيل غرفة الكشف"
            description="إيقاف هذا الخيار يعطّل صفحة غرفة الكشف بالكامل للأطباء."
            value={settings.enabled}
            onChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
          />

          <div className="border-t border-slate-100 pt-3 mt-2 space-y-3">
            <Toggle
              label="السماح بالشات بين الطبيب والمريض"
              description="يعتمد على نظام الرسائل الحالي (dm_conversations / dm_messages)."
              value={settings.chatEnabled}
              onChange={(v) => setSettings((s) => ({ ...s, chatEnabled: v }))}
            />

            <Toggle
              label="السماح بالصوت (الميكروفون)"
              value={settings.audioEnabled}
              onChange={(v) => setSettings((s) => ({ ...s, audioEnabled: v }))}
            />

            <Toggle
              label="السماح بالفيديو (الكاميرا)"
              value={settings.videoEnabled}
              onChange={(v) => setSettings((s) => ({ ...s, videoEnabled: v }))}
            />

            <Toggle
              label="إظهار لوحة العلامات الحيوية"
              description="تستخدم جدول patient_vitals الموجود لديك، بدون أي تعديل."
              value={settings.vitalsEnabled}
              onChange={(v) => setSettings((s) => ({ ...s, vitalsEnabled: v }))}
            />

            <Toggle
              label="إظهار صورة السيفتي (طيارات / إسعاف / شرطة)"
              description="يمكنك تحديد رابط الصورة من حقل الإعدادات بالأسفل."
              value={settings.safetyEnabled}
              onChange={(v) => setSettings((s) => ({ ...s, safetyEnabled: v }))}
            />
          </div>

          <div className="border-t border-slate-100 pt-4 mt-2 space-y-2">
            <div className="text-sm font-semibold text-slate-900">
              رابط صورة السيفتي
            </div>
            <p className="text-xs text-slate-500">
              ضع مسار الصورة من Supabase Storage أو أي رابط https. ستظهر في ركن
              غرفة الكشف، ويمكن تعطيلها من الزر أعلاه.
            </p>
            <input
              type="text"
              value={settings.safetyImageUrl}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  safetyImageUrl: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300"
              placeholder="مثال: https://xyz.supabase.co/storage/v1/object/public/..."
            />
          </div>

          <div className="pt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={saveAll}
              disabled={saveState === "saving"}
              className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {saveState === "saving"
                ? "جارٍ الحفظ..."
                : saveState === "saved"
                ? "تم الحفظ ✅"
                : "حفظ الإعدادات"}
            </button>

            {saveState === "error" && (
              <div className="text-xs text-red-500">
                حدث خطأ أثناء الحفظ، تأكد من اتصالك أو صلاحيات system_settings_kv.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
