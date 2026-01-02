// src/components/queue/PatientQueueClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { getFeatureFlags } from "@/utils/systemSettings";

type QRow = {
  id: string;
  doctor_id: string;
  patient_id: string;
  status: "waiting" | "called" | "in_session" | "done" | "canceled";
  position: number | null;
  expected_minutes: number | null;
  is_free: boolean | null;
  price: number | null;
  currency: string | null;
  requested_at?: string | null;
};

export default function PatientQueueClient() {
  const [me, setMe] = useState<string | null>(null);
  const [rows, setRows] = useState<QRow[]>([]);
  const [avgMin, setAvgMin] = useState<number>(10);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id ?? null;
        if (!uid) {
          setErr("يجب تسجيل الدخول.");
          return;
        }
        if (!alive) return;
        setMe(uid);

        const flags = await getFeatureFlags();
        if (!alive) return;
        setAvgMin(flags.avg_visit_minutes || 10);

        const { data, error } = await supabase
          .from("consultation_queue")
          .select("*")
          .eq("patient_id", uid)
          .in("status", ["waiting", "called", "in_session"])
          .order("requested_at", { ascending: false });

        if (error) throw error;
        if (!alive) return;
        setRows((data as any) ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Error");
      }
    })();

    const t = setInterval(() => {
      if (!me) return;
      supabase
        .from("consultation_queue")
        .select("*")
        .eq("patient_id", me)
        .in("status", ["waiting", "called", "in_session"])
        .order("requested_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) return;
          setRows((data as any) ?? []);
        });
    }, 5000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [me]);

  const current = rows[0] ?? null;

  const estimated = useMemo(() => {
    if (!current) return { ahead: 0, minutes: 0 };
    // Basic estimate: (position-1)*avgMin. If expected_minutes is set, use avgMin still for prior.
    const pos = current.position ?? 1;
    const ahead = Math.max(0, pos - 1);
    const minutes = ahead * (avgMin || 10);
    return { ahead, minutes };
  }, [current, avgMin]);

  async function cancelRequest(id: string) {
    const { error } = await supabase
      .from("consultation_queue")
      .update({ status: "canceled", canceled_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (error) throw error;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">Patient</div>
          <h1 className="text-xl font-extrabold">انتظار المريض</h1>
          <div className="text-sm text-slate-300 mt-1">التحديث تلقائي كل 5 ثوانٍ.</div>
        </div>

        <Link
          href="/home"
          className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          العودة للموقع ➜
        </Link>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{err}</div>
      ) : null}

      {!current ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          لا يوجد طلب نشط في الطابور.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-3">
          <div className="text-sm text-slate-300">
            الحالة: <span className="font-extrabold text-slate-100">{current.status}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Box title="رقمك في الطابور" value={String(current.position ?? "—")} />
            <Box title="المنتظرون قبلك" value={String(estimated.ahead)} />
            <Box title="الوقت المتوقع" value={`${estimated.minutes} دقيقة`} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
            {current.is_free ? (
              <div>
                <span className="font-extrabold text-emerald-200">مجاني</span>
              </div>
            ) : (
              <div>
                <span className="font-extrabold text-amber-200">مدفوع</span> — السعر:
                <span className="font-extrabold text-slate-100">
                  {" "}
                  {current.price ?? 0} {current.currency ?? "SAR"}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(current.status === "called" || current.status === "in_session") && (
              <Link
                href={`/clinic/${current.id}`}
                className="rounded-xl border border-emerald-700 bg-emerald-900/20 px-4 py-2 text-sm font-extrabold text-emerald-200 hover:bg-emerald-900/30"
              >
                دخول غرفة العيادة ➜
              </Link>
            )}

            {current.status === "waiting" ? (
              <button
                onClick={async () => {
                  try {
                    setErr(null);
                    await cancelRequest(current.id);
                  } catch (e: any) {
                    setErr(e?.message ?? "Error");
                  }
                }}
                className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-2 text-sm font-extrabold text-red-200 hover:bg-red-950/55"
              >
                إلغاء الطلب
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
    </div>
  );
}
