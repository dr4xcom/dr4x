"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type ClinicSettings = {
  emergencyHours: string;
  emergencyPrice: string; // نخزنها كـ string في الـ state ونحوّلها لرقم عند الحفظ
  deptDefaultHours: string;
  deptDefaultPrice: string;
};

type LoadState = "idle" | "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

const KEYS = {
  emergencyHours: "clinic_emergency_hours",
  emergencyPrice: "clinic_emergency_price",
  deptDefaultHours: "clinic_dept_default_hours",
  deptDefaultPrice: "clinic_dept_default_price",
} as const;

export default function ClinicSettingsPage() {
  const [settings, setSettings] = useState<ClinicSettings>({
    emergencyHours: "",
    emergencyPrice: "",
    deptDefaultHours: "",
    deptDefaultPrice: "",
  });

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  // 🔹 تحميل القيم من system_settings
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadState("loading");
        setError("");
        setMessage("");

        const { data, error } = await supabase
          .from("system_settings")
          .select("key, value, value_number")
          .in("key", [
            KEYS.emergencyHours,
            KEYS.emergencyPrice,
            KEYS.deptDefaultHours,
            KEYS.deptDefaultPrice,
          ]);

        if (error) throw error;

        const map = new Map<
          string,
          { value: string | null; value_number: number | null }
        >();

        (data || []).forEach((row: any) => {
          map.set(row.key, {
            value: row.value ?? null,
            value_number:
              typeof row.value_number === "number" ? row.value_number : null,
          });
        });

        if (!alive) return;

        setSettings({
          emergencyHours:
            map.get(KEYS.emergencyHours)?.value ?? "طوارئ 24 ساعة",
          emergencyPrice:
            map.get(KEYS.emergencyPrice)?.value_number != null
              ? String(map.get(KEYS.emergencyPrice)!.value_number)
              : "",
          deptDefaultHours:
            map.get(KEYS.deptDefaultHours)?.value ?? "من 4:00 م إلى 10:00 م",
          deptDefaultPrice:
            map.get(KEYS.deptDefaultPrice)?.value_number != null
              ? String(map.get(KEYS.deptDefaultPrice)!.value_number)
              : "",
        });

        setLoadState("ready");
      } catch (e: any) {
        if (!alive) return;
        console.error(e);
        setError(e?.message ?? "تعذر تحميل إعدادات العيادة.");
        setLoadState("error");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  function handleChange(field: keyof ClinicSettings, value: string) {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // 🔹 حفظ القيم في system_settings (بدون أي تغيير في الجداول)
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaveState("saving");
      setError("");
      setMessage("");

      const emergencyPriceNum =
        settings.emergencyPrice.trim() === ""
          ? null
          : Number(settings.emergencyPrice.trim());

      const deptPriceNum =
        settings.deptDefaultPrice.trim() === ""
          ? null
          : Number(settings.deptDefaultPrice.trim());

      if (
        settings.emergencyPrice.trim() !== "" &&
        Number.isNaN(emergencyPriceNum)
      ) {
        setSaveState("error");
        setError("قيمة سعر كشف الطوارئ يجب أن تكون رقمًا صحيحًا.");
        return;
      }

      if (
        settings.deptDefaultPrice.trim() !== "" &&
        Number.isNaN(deptPriceNum)
      ) {
        setSaveState("error");
        setError("قيمة السعر الافتراضي للعيادات يجب أن تكون رقمًا صحيحًا.");
        return;
      }

      const rows = [
        {
          key: KEYS.emergencyHours,
          value: settings.emergencyHours.trim() || null,
          value_number: null,
        },
        {
          key: KEYS.emergencyPrice,
          value: null,
          value_number: emergencyPriceNum,
        },
        {
          key: KEYS.deptDefaultHours,
          value: settings.deptDefaultHours.trim() || null,
          value_number: null,
        },
        {
          key: KEYS.deptDefaultPrice,
          value: null,
          value_number: deptPriceNum,
        },
      ];

      const { error } = await supabase
        .from("system_settings")
        .upsert(rows, { onConflict: "key" });

      if (error) throw error;

      setSaveState("saved");
      setMessage("تم حفظ إعدادات العيادة بنجاح.");
    } catch (e: any) {
      console.error(e);
      setSaveState("error");
      setError(e?.message ?? "تعذر حفظ الإعدادات.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">
            إعدادات العيادة (الأسعار والأوقات)
          </div>
          <h1 className="text-xl font-extrabold tracking-wide">
            Clinic Settings
          </h1>
        </div>
      </div>

      {loadState === "loading" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          جارٍ تحميل إعدادات العيادة…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-900/70 bg-red-950/50 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {message && !error && (
        <div className="rounded-2xl border border-emerald-700/70 bg-emerald-950/40 p-4 text-sm text-emerald-100">
          {message}
        </div>
      )}

      {loadState === "ready" && (
        <form
          onSubmit={handleSave}
          className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
        >
          {/* إعدادات الطوارئ */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-100">
              إعدادات عيادة الطوارئ
            </div>

            <label className="block text-xs text-slate-300 mb-1">
              أوقات الطوارئ (نص حر):
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              placeholder="مثال: طوارئ 24 ساعة"
              value={settings.emergencyHours}
              onChange={(e) => handleChange("emergencyHours", e.target.value)}
            />

            <label className="block text-xs text-slate-300 mb-1 mt-3">
              سعر كشف الطوارئ (ريال):
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              placeholder="مثال: 250"
              value={settings.emergencyPrice}
              onChange={(e) => handleChange("emergencyPrice", e.target.value)}
            />

            <p className="mt-1 text-[11px] text-slate-400">
              اترك السعر فارغًا إذا كنت تريد ضبطه يدويًا من قسم آخر لاحقًا.
            </p>
          </div>

          <hr className="border-slate-800" />

          {/* إعدادات العيادات العادية */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-100">
              إعدادات العيادات العادية (كل الأقسام)
            </div>

            <label className="block text-xs text-slate-300 mb-1">
              أوقات العيادات (نص حر):
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              placeholder="مثال: من 4:00 م إلى 10:00 م"
              value={settings.deptDefaultHours}
              onChange={(e) => handleChange("deptDefaultHours", e.target.value)}
            />

            <label className="block text-xs text-slate-300 mb-1 mt-3">
              السعر الافتراضي لكشف العيادات (ريال):
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              placeholder="مثال: 150 — اتركه فارغًا لو السعر يختلف حسب القسم"
              value={settings.deptDefaultPrice}
              onChange={(e) => handleChange("deptDefaultPrice", e.target.value)}
            />

            <p className="mt-1 text-[11px] text-slate-400">
              إذا تركته فارغًا، سيتم عرض عبارة &quot;السعر حسب القسم&quot; في
              صفحة اختيار القسم.
            </p>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saveState === "saving"}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {saveState === "saving" ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
