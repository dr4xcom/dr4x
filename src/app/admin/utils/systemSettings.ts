// src/app/admin/utils/systemSettings.ts
"use client";

import { supabase } from "@/utils/supabase/client";

export type SystemSettingsMap = Record<string, string | null>;

type SystemSettingRow = {
  key: string;
  value: string | null;
};

const CACHE_KEY = "__dr4x_system_settings_cache_v1";
const CACHE_TTL_MS = 60_000; // دقيقة (خفيف ويقلل البطء)

// قراءة كاش بسيط من sessionStorage (اختياري)
function readCache(): { ts: number; data: SystemSettingsMap } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: SystemSettingsMap };
    if (!parsed?.ts || !parsed?.data) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: SystemSettingsMap) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore
  }
}

/**
 * ✅ أفضل طريقة: جلب عدة مفاتيح دفعة واحدة
 * - بدون URL يدوي
 * - بدون مسافات تكسر PostgREST
 * - يقلل عدد الطلبات (يحسن الأداء)
 */
export async function getSystemSettings(keys: string[]): Promise<SystemSettingsMap> {
  const cleanKeys = Array.from(
    new Set(
      keys
        .map((k) => (k ?? "").trim())
        .filter(Boolean)
    )
  );

  if (cleanKeys.length === 0) return {};

  // Cache
  const cached = readCache();
  if (cached) {
    // رجّع من الكاش لو متوفر
    const out: SystemSettingsMap = {};
    for (const k of cleanKeys) out[k] = cached.data?.[k] ?? null;

    // لو كل شيء موجود بالكاش رجع فورًا
    const allHit = cleanKeys.every((k) => k in (cached.data || {}));
    if (allHit) return out;
    // وإلا نكمل نجلب الناقص من الداتابيس
  }

  const { data, error } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", cleanKeys);

  if (error) {
    console.error("getSystemSettings error:", error);
    // رجع nulls بدل ما تكسر الصفحة
    const fallback: SystemSettingsMap = {};
    for (const k of cleanKeys) fallback[k] = null;
    return fallback;
  }

  const map: SystemSettingsMap = {};
  for (const k of cleanKeys) map[k] = null;

  (data as SystemSettingRow[] | null)?.forEach((row) => {
    map[row.key] = row.value ?? null;
  });

  // ادمج مع الكاش القديم
  const prev = readCache()?.data ?? {};
  writeCache({ ...prev, ...map });

  return map;
}

/**
 * ✅ جلب مفتاح واحد
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  const k = (key ?? "").trim();
  if (!k) return null;

  const cached = readCache();
  if (cached && k in cached.data) return cached.data[k] ?? null;

  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", k)
    .maybeSingle();

  if (error) {
    console.error("getSystemSetting error:", error);
    return null;
  }

  const value = (data as { value?: string | null } | null)?.value ?? null;
  const prev = readCache()?.data ?? {};
  writeCache({ ...prev, [k]: value });
  return value;
}

/**
 * ✅ مساعدة: تحويل مسار Storage إلى URL عام
 * (لو أنت تخزن path فقط)
 */
export function storagePublicUrl(bucket: string, path: string | null | undefined) {
  const p = (path ?? "").trim();
  if (!p) return null;
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(p);
    return data.publicUrl;
  } catch {
    return null;
  }
}
