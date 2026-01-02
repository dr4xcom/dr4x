// src/components/admin/FeatureFlagsClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type SystemSettingsRow = {
  id: number;
  feature_flags: Record<string, any> | null;
};

export default function FeatureFlagsClient() {
  const [settings, setSettings] = useState<SystemSettingsRow | null>(null);
  const [allowDmDelete, setAllowDmDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // تحميل system_settings مرة واحدة
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);

        const { data, error } = await supabase
          .from("system_settings")
          .select("id, feature_flags")
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!alive) return;

        const row = (data ?? null) as SystemSettingsRow | null;
        setSettings(row);

        const flag =
          row?.feature_flags &&
          typeof row.feature_flags.allow_dm_delete === "boolean"
            ? Boolean(row.feature_flags.allow_dm_delete)
            : false;

        setAllowDmDelete(flag);
      } catch (e: any) {
        if (!alive) return;
        console.error("load system_settings error", e);
        setError(e?.message ?? "تعذر تحميل إعدادات النظام.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function handleToggle() {
    if (!settings) {
      setError("لم يتم العثور على سجل في system_settings.");
      return;
    }

    const newValue = !allowDmDelete;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const currentFlags = (settings.feature_flags || {}) as Record<
        string,
        any
      >;

      const newFlags = {
        ...currentFlags,
        allow_dm_delete: newValue,
      };

      const { error } = await supabase
        .from("system_settings")
        .update({
          feature_flags: newFlags,
          // لو عندك trigger يحدث updated_at ما في مشكلة، السطر التالي اختياري
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);

      if (error) throw error;

      setSettings((old) =>
        old ? { ...old, feature_flags: newFlags } : old
      );
      setAllowDmDelete(newValue);
      setSuccess(
        newValue
          ? "✅ تم تفعيل إمكانية حذف الرسائل الخاصة."
          : "✅ تم إيقاف حذف الرسائل الخاصة (لن يستطيع الأعضاء الحذف)."
      );
    } catch (e: any) {
      console.error("update feature_flags error", e);
      setError(e?.message ?? "تعذر حفظ الإعداد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm sm:text-base font-semibold text-slate-100">
            التحكم في حذف الرسائل الخاصة
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            هذا الخيار يحدد هل يمكن للأعضاء حذف رسائلهم في المحادثات الخاصة أم لا.
            التغيير يطبق فورًا على دالة <code>dm_delete_message</code>.
          </p>
        </div>

        {/* زر التبديل */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading || saving || !settings}
          className={[
            "relative inline-flex h-8 w-16 items-center rounded-full border transition",
            allowDmDelete
              ? "bg-emerald-500 border-emerald-400"
              : "bg-slate-800 border-slate-600",
            loading || saving || !settings ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition",
              allowDmDelete ? "translate-x-7" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </div>

      <div className="text-xs sm:text-sm text-slate-300">
        <span className="font-semibold">
          الحالة الحالية:{" "}
        </span>
        {loading
          ? "جاري التحميل…"
          : allowDmDelete
          ? "مسموح بحذف الرسائل الخاصة."
          : "ممنوع حذف الرسائل الخاصة (إلا لو عدّل المدير من هنا)."}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/70 bg-red-900/40 px-3 py-2 text-xs sm:text-sm text-red-50 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-500/60 bg-emerald-900/30 px-3 py-2 text-xs sm:text-sm text-emerald-50 whitespace-pre-wrap">
          {success}
        </div>
      )}

      {!settings && !loading && !error && (
        <div className="text-xs sm:text-sm text-amber-300">
          لم يتم العثور على سجل في جدول <code>system_settings</code>.
          تأكد أن هناك صف واحد على الأقل (id = 1) ثم أعد تحميل الصفحة.
        </div>
      )}
    </div>
  );
}
