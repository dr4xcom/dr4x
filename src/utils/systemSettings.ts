// src/utils/systemSettings.ts
import { supabase } from "@/utils/supabase/client";

type KVRow = {
  key: string;
  value: any;
  updated_at?: string | null;
};

function parseBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  if (v && typeof v === "object" && "enabled" in v) return !!(v as any).enabled;
  return false;
}

function parseNumber(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === "object" && "value" in v) {
    const n = Number((v as any).value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** ================== CACHE ================== **/
let cache: { loaded: boolean; map: Record<string, any> } = {
  loaded: false,
  map: {},
};
let inflight: Promise<void> | null = null;

async function loadAllSettingsOnce(): Promise<void> {
  if (cache.loaded) return;
  if (inflight) return inflight;

  inflight = (async () => {
    // نقرأ من system_settings_kv فقط (جدول مفاتيح / قيم)
    const { data, error } = await supabase
      .from("system_settings_kv")
      .select("*");

    if (error || !Array.isArray(data)) {
      cache = { loaded: true, map: {} };
      return;
    }

    const map: Record<string, any> = {};
    for (const row of data as KVRow[]) {
      const k = (row.key || "").trim();
      if (!k) continue;
      map[k] = row.value;
    }

    cache = { loaded: true, map };
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

async function getSettingRaw(key: string): Promise<any> {
  await loadAllSettingsOnce();
  return cache.map[key];
}

async function upsertSetting(key: string, value: any): Promise<void> {
  const { error } = await supabase
    .from("system_settings_kv")
    .upsert(
      [
        {
          key,
          value,
        },
      ],
      { onConflict: "key" as any }
    );

  if (error) {
    throw error;
  }

  // نعيد تحميل الكاش في المرة الجاية
  cache.loaded = false;
}

/* =============== Feature Flags (جلسة الفيديو) =============== */

export type FeatureFlags = {
  live_video_enabled: boolean;
  live_audio_enabled: boolean;
  live_chat_enabled: boolean;
  live_attachments_enabled: boolean;
  prescriptions_enabled: boolean;
  vitals_panel_enabled: boolean;
  admin_join_enabled: boolean;
  max_visit_minutes: number;
  avg_visit_minutes: number;
};

export const DEFAULT_FLAGS: FeatureFlags = {
  live_video_enabled: false,
  live_audio_enabled: true,
  live_chat_enabled: true,
  live_attachments_enabled: true,
  prescriptions_enabled: true,
  vitals_panel_enabled: true,
  admin_join_enabled: true,
  max_visit_minutes: 20,
  avg_visit_minutes: 10,
};

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const keys = Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[];
  const out: any = { ...DEFAULT_FLAGS };

  await loadAllSettingsOnce();

  for (const key of keys) {
    const raw = cache.map[String(key)];
    if (raw == null) continue;

    if (typeof out[key] === "boolean") {
      out[key] = parseBool(raw);
    } else {
      out[key] = parseNumber(raw);
    }
  }

  return out as FeatureFlags;
}

export async function setFeatureFlag(
  key: keyof FeatureFlags,
  value: boolean | number
) {
  await upsertSetting(String(key), value);
}

/* =============== Generic Settings (نص / رقم / منطقية) =============== */

export async function getSystemSettingString(
  key: string,
  fallback = ""
): Promise<string> {
  const raw = await getSettingRaw(key);
  if (raw == null) return fallback;

  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "boolean") return raw ? "true" : "false";

  try {
    return JSON.stringify(raw);
  } catch {
    return fallback;
  }
}

export async function getSystemSettingBool(
  key: string,
  fallback = false
): Promise<boolean> {
  const raw = await getSettingRaw(key);
  return raw == null ? fallback : parseBool(raw);
}

export async function getSystemSettingNumber(
  key: string,
  fallback = 0
): Promise<number> {
  const raw = await getSettingRaw(key);
  return raw == null ? fallback : parseNumber(raw);
}

export async function setSystemSettingRaw(key: string, value: any) {
  await upsertSetting(key, value);
}
