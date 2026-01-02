// src/components/clinic/PatientVitalsPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type VRow = {
  id?: string;
  patient_id: string;
  recorded_by?: string | null;
  vital_type: string;
  value_numeric: number | null;
  value2_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  recorded_at: string | null;
};

export default function PatientVitalsPanel({
  patientId,
  disabled,
}: {
  patientId: string;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<VRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);

  // ───────── 1) جلب بيانات المريض الأساسية ─────────
  useEffect(() => {
    if (!patientId) return;

    let alive = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", patientId)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.error("profiles error", error);
          return;
        }

        if (data) {
          const n = (data.full_name || "").trim();
          const u = (data.username || "").trim();
          setPatientName(n || u || null);
        }
      } catch (e) {
        console.error("profiles unexpected error", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [patientId]);

  // ───────── 2) جلب العلامات الحيوية من patient_vitals ─────────
  useEffect(() => {
    if (!patientId || disabled) return;

    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const { data, error } = await supabase
          .from("patient_vitals")
          .select(
            "id, patient_id, recorded_by, vital_type, value_numeric, value2_numeric, value_text, unit, recorded_at"
          )
          .eq("patient_id", patientId) // 👈 أهم شيء: نستخدم patient_id
          .order("recorded_at", { ascending: false })
          .limit(50);

        if (!alive) return;

        if (error) {
          console.error("patient_vitals error", error);
          setErr("تعذّر تحميل العلامات الحيوية للمريض.");
          setRows([]);
          return;
        }

        setRows((data || []) as VRow[]);
      } catch (e: any) {
        if (!alive) return;
        console.error("patient_vitals unexpected error", e);
        setErr(e?.message ?? "تعذّر تحميل العلامات الحيوية للمريض.");
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [patientId, disabled]);

  // ───────── 3) اختيار آخر قراءة لكل نوع من القياس ─────────
  const latestVitals = useMemo(() => {
    const map = new Map<string, VRow>();

    for (const r of rows) {
      if (!r.vital_type) continue;
      if (!map.has(r.vital_type)) {
        map.set(r.vital_type, r); // لأننا مرتبّين DESC، أول واحد هو الأحدث
      }
    }

    return Array.from(map.entries()).map(([type, row]) => ({
      type,
      row,
    }));
  }, [rows]);

  function formatValue(v: VRow) {
    if (v.value_text && v.value_text.trim().length > 0) {
      return v.value_text.trim();
    }

    if (v.value_numeric != null && v.value2_numeric != null) {
      return `${v.value_numeric} / ${v.value2_numeric}${
        v.unit ? ` ${v.unit}` : ""
      }`;
    }

    if (v.value_numeric != null) {
      return `${v.value_numeric}${v.unit ? ` ${v.unit}` : ""}`;
    }

    if (v.value2_numeric != null) {
      return `${v.value2_numeric}${v.unit ? ` ${v.unit}` : ""}`;
    }

    return "—";
  }

  function formatType(type: string) {
    switch (type) {
      case "blood_pressure":
        return "ضغط الدم";
      case "temperature":
        return "الحرارة";
      case "weight":
        return "الوزن";
      case "height":
        return "الطول";
      case "glucose":
        return "السكر في الدم";
      default:
        return type;
    }
  }

  function formatRecordedAt(v: VRow) {
    if (!v.recorded_at) return "";
    try {
      const d = new Date(v.recorded_at);
      return d.toLocaleString("ar-SA", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return v.recorded_at;
    }
  }

  // ───────── 4) في حالة التعطيل من لوحة التحكم ─────────
  if (disabled) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
        تم إيقاف لوحة العلامات الحيوية من إعدادات الإدارة.
      </div>
    );
  }

  // ───────── 5) الواجهة ─────────
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
      {/* بيانات المريض الأساسية (بسيطة) */}
      <div className="rounded-xl bg-slate-900/70 px-3 py-2 text-xs text-slate-300 space-y-1">
        <div className="font-semibold text-slate-100">
          بيانات المريض الأساسية
        </div>
        <div>
          الاسم:{" "}
          <span className="font-extrabold text-emerald-300">
            {patientName || "—"}
          </span>
        </div>
        <div className="text-[11px] text-slate-500 break-all">
          Patient ID: {patientId}
        </div>
      </div>

      {/* آخر العلامات الحيوية */}
      <div className="rounded-xl bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
        <div className="font-semibold text-slate-100 mb-1">
          آخر العلامات الحيوية
        </div>

        {loading && (
          <div className="text-slate-400">جارٍ تحميل العلامات الحيوية…</div>
        )}

        {err && !loading && (
          <div className="text-red-300 text-[11px]">{err}</div>
        )}

        {!loading && !err && latestVitals.length === 0 && (
          <div className="text-slate-400">
            لا توجد قياسات جديدة مسجّلة لهذا المريض.
          </div>
        )}

        {!loading && !err && latestVitals.length > 0 && (
          <ul className="space-y-1">
            {latestVitals.map(({ type, row }) => (
              <li
                key={type}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/70 px-2 py-1"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-50">
                    {formatType(type)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {formatRecordedAt(row)}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-extrabold text-emerald-300">
                  {formatValue(row)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
