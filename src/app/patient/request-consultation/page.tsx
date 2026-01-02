"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

function safeNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function PatientRequestConsultationPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("SAR");
  const [expectedMinutes, setExpectedMinutes] = useState("15");
  const [note, setNote] = useState("");

  async function submit() {
    try {
      setErr(null);
      setOk(null);
      setLoading(true);

      const payload = {
        p_is_free: isFree,
        p_price: isFree ? 0 : safeNum(price),
        p_currency: currency.trim() || "SAR",
        p_expected_minutes: expectedMinutes.trim() ? safeNum(expectedMinutes) : null,
        p_note: note.trim() || null,
      };

      const { data, error } = await supabase.rpc("request_consultation", payload);
      if (error) throw error;

      setOk(`تم إرسال الطلب بنجاح. Queue ID: ${String(data)}`);
      setNote("");

      // تقدر لاحقًا توجهه لصفحة "طلباتي"
      // router.push("/patient/consultations");
    } catch (e: any) {
      setErr(e?.message ?? "تعذر إرسال طلب الاستشارة.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-slate-400">Patient</div>
        <h2 className="text-lg font-extrabold">طلب استشارة</h2>
        <div className="text-sm text-slate-300">
          هذا الطلب يدخل طابور الانتظار، والطبيب عند القبول سيتم إنشاء الاستشارة تلقائيًا.
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {ok ? (
        <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          {ok}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              className="accent-slate-200"
            />
            مجاني
          </label>

          {!isFree ? (
            <>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="السعر"
                inputMode="decimal"
                className="w-32 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
              />
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="العملة"
                className="w-24 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
              />
            </>
          ) : (
            <div className="text-sm text-slate-400">السعر = 0</div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={expectedMinutes}
            onChange={(e) => setExpectedMinutes(e.target.value)}
            placeholder="مدة متوقعة بالدقائق (اختياري)"
            inputMode="numeric"
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
          />
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="العملة"
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
          />
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ملاحظة للمريض/سبب الزيارة (اختياري)"
          className="min-h-[110px] w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
              loading
                ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                : "border-slate-800 bg-slate-900/40 text-slate-200 hover:bg-slate-900",
            ].join(" ")}
          >
            {loading ? "…" : "إرسال الطلب"}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/40"
          >
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}
