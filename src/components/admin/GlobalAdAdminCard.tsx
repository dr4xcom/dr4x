"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type AdType = "image" | "video" | "audio";

type SettingsMap = Record<string, { value: string | null; value_number: number | null }>;

async function readSettings(keys: string[]): Promise<SettingsMap> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value, value_number")
    .in("key", keys);

  if (error) throw error;

  const map: SettingsMap = {};
  for (const k of keys) map[k] = { value: null, value_number: null };
  for (const row of data ?? []) {
    map[row.key] = { value: row.value ?? null, value_number: row.value_number ?? null };
  }
  return map;
}

async function upsertSettingText(key: string, value: string | null) {
  // نخزن في value (text)
  const payload = { key, value, value_number: null };

  // upsert يتطلب UNIQUE على key (غالبًا عندك موجود)
  const { error } = await supabase.from("system_settings").upsert(payload, { onConflict: "key" });
  if (!error) return;

  // fallback (لو ما فيه unique): نجرب update ثم insert
  const u = await supabase.from("system_settings").update(payload).eq("key", key);
  if (!u.error && (u.count ?? 0) > 0) return;

  const i = await supabase.from("system_settings").insert(payload);
  if (i.error) throw i.error;
}

async function upsertSettingNumber(key: string, value_number: number | null) {
  // نخزن في value_number (numeric)
  const payload = { key, value: null, value_number };

  const { error } = await supabase.from("system_settings").upsert(payload, { onConflict: "key" });
  if (!error) return;

  const u = await supabase.from("system_settings").update(payload).eq("key", key);
  if (!u.error && (u.count ?? 0) > 0) return;

  const i = await supabase.from("system_settings").insert(payload);
  if (i.error) throw i.error;
}

function guessType(file: File): AdType {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  return "image";
}

export default function GlobalAdAdminCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [adType, setAdType] = useState<AdType>("image");
  const [duration, setDuration] = useState<number>(30);
  const [path, setPath] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const s = await readSettings([
          "global_ad_enabled",
          "global_ad_type",
          "global_ad_path",
          "global_ad_duration",
        ]);

        if (!alive) return;

        setEnabled((s.global_ad_enabled?.value ?? "false") === "true");

        const t = (s.global_ad_type?.value ?? "image") as AdType;
        setAdType(t === "video" || t === "audio" || t === "image" ? t : "image");

        const d =
          typeof s.global_ad_duration?.value_number === "number"
            ? s.global_ad_duration.value_number
            : Number(s.global_ad_duration?.value ?? 30);

        setDuration(Number.isFinite(d) && d > 0 ? Math.floor(d) : 30);

        setPath(s.global_ad_path?.value ?? "");
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load settings");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const previewUrl = useMemo(() => {
    if (!path) return "";
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return "";
    return `${base}/storage/v1/object/public/ads/${path}`;
  }, [path]);

  async function handleUploadAndSave() {
    setMsg(null);
    setErr(null);

    try {
      setSaving(true);

      let finalType = adType;
      let finalPath = path.trim();

      // 1) لو فيه ملف جديد -> نرفعه
      if (file) {
        finalType = guessType(file);

        const ext = (file.name.split(".").pop() || "").toLowerCase();
        const safeExt = ext ? `.${ext}` : "";
        const folder = finalType === "image" ? "images" : finalType === "video" ? "videos" : "audio";
        const filename = `ad_${Date.now()}${safeExt}`;
        finalPath = `${folder}/${filename}`;

        const { error: upErr } = await supabase.storage
          .from("ads")
          .upload(finalPath, file, {
            upsert: true,
            contentType: file.type || undefined,
          });

        if (upErr) {
          // أكثر خطأ شائع: RLS على storage.objects
          throw new Error(
            `Upload failed: ${upErr.message}. إذا ظهر RLS/permission راجع سياسات bucket ads.`
          );
        }
      }

      // 2) نحفظ الإعدادات في system_settings
      await upsertSettingText("global_ad_enabled", enabled ? "true" : "false");
      await upsertSettingText("global_ad_type", finalType);
      await upsertSettingText("global_ad_path", finalPath || null);
      await upsertSettingNumber("global_ad_duration", Number(duration) || 30);

      // تحديث الحالة المحلية
      setAdType(finalType);
      setPath(finalPath);
      setFile(null);

      setMsg("تم حفظ الإعلان بنجاح ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dr4x-card p-4 bg-white">
      <div className="flex items-center justify-between gap-3">
        <div className="font-extrabold text-slate-900">إعلان مؤقت (Global Ad)</div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="font-semibold">تفعيل</span>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 p-3">
          <div className="text-xs font-bold text-slate-600 mb-2">مدة العرض (ثانية)</div>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value || 1)))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="text-[11px] text-slate-500 mt-2">
            مثال: 30 يعني يظهر 30 ثانية ثم يختفي
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-3">
          <div className="text-xs font-bold text-slate-600 mb-2">رفع ملف الإعلان</div>
          <input
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          <div className="text-[11px] text-slate-500 mt-2">
            تقدر ترفع صورة أو فيديو أو صوت. سيتم تحديد النوع تلقائيًا.
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 p-3">
        <div className="text-xs font-bold text-slate-600 mb-2">حالة الإعلان الحالي</div>

        <div className="text-sm text-slate-800">
          <span className="font-semibold">النوع:</span> {adType}
        </div>
        <div className="text-sm text-slate-800 mt-1 break-all">
          <span className="font-semibold">المسار:</span> {path || "—"}
        </div>

        {previewUrl ? (
          <div className="mt-3">
            {adType === "image" ? (
              <img src={previewUrl} alt="ad" className="w-full max-w-md rounded-xl border" />
            ) : adType === "video" ? (
              <video src={previewUrl} controls className="w-full max-w-md rounded-xl border" />
            ) : (
              <audio src={previewUrl} controls className="w-full max-w-md" />
            )}
          </div>
        ) : null}
      </div>

      {msg ? <div className="mt-3 text-sm text-emerald-700 font-semibold">{msg}</div> : null}
      {err ? <div className="mt-3 text-sm text-red-700 font-semibold">{err}</div> : null}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleUploadAndSave}
          disabled={loading || saving}
          className="rounded-full bg-slate-900 text-white px-5 py-2 font-extrabold hover:opacity-95 disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ الإعلان"}
        </button>

        {loading ? <div className="text-sm text-slate-500">تحميل الإعدادات...</div> : null}
      </div>
    </div>
  );
}
