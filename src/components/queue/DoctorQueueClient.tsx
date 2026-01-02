// src/components/queue/DoctorQueueClient.tsx
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
  called_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  canceled_at?: string | null;
};

function badge(status: QRow["status"]) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold border";
  if (status === "waiting") return `${base} border-slate-700 bg-slate-900/60 text-slate-200`;
  if (status === "called") return `${base} border-amber-700 bg-amber-900/20 text-amber-200`;
  if (status === "in_session") return `${base} border-emerald-700 bg-emerald-900/20 text-emerald-200`;
  if (status === "done") return `${base} border-slate-700 bg-slate-900/40 text-slate-300`;
  return `${base} border-red-700 bg-red-900/20 text-red-200`;
}

export default function DoctorQueueClient() {
  const [rows, setRows] = useState<QRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [avgMin, setAvgMin] = useState<number>(10);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
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
          .eq("doctor_id", uid)
          .order("status", { ascending: true })
          .order("position", { ascending: true })
          .order("requested_at", { ascending: true });

        if (error) throw error;
        if (!alive) return;
        setRows((data as any) ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Error");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    const t = setInterval(() => {
      // Refresh lightweight
      if (!me) return;
      supabase
        .from("consultation_queue")
        .select("*")
        .eq("doctor_id", me)
        .order("status", { ascending: true })
        .order("position", { ascending: true })
        .order("requested_at", { ascending: true })
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

  const waiting = useMemo(() => rows.filter((r) => r.status === "waiting"), [rows]);

  async function updateRow(id: string, patch: Partial<QRow>) {
    const { error } = await supabase.from("consultation_queue").update(patch as any).eq("id", id);
    if (error) throw error;

    const { data } = await supabase
      .from("consultation_queue")
      .select("*")
      .eq("doctor_id", me as any)
      .order("status", { ascending: true })
      .order("position", { ascending: true })
      .order("requested_at", { ascending: true });

    setRows((data as any) ?? []);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm">جارٍ التحميل…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Doctor</div>
          <h1 className="text-xl font-extrabold">طابور الطبيب</h1>
          <div className="text-sm text-slate-300 mt-1">
            متوسط وقت الزيارة المستخدم للتقدير: <span className="font-bold">{avgMin}</span> دقيقة
          </div>
        </div>

        <Link
          href="/admin"
          className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          لوحة الإدارة ➜
        </Link>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="font-bold mb-3">المنتظرون</div>

          {waiting.length === 0 ? (
            <div className="text-sm text-slate-400">لا يوجد منتظرون الآن.</div>
          ) : (
            <div className="space-y-3">
              {waiting.map((r, idx) => (
                <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-300">
                      رقم الطابور: <span className="font-extrabold text-slate-100">{r.position ?? idx + 1}</span>
                    </div>
                    <span className={badge(r.status)}>waiting</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-slate-400">مدة الزيارة (دقيقة)</div>
                      <input
                        type="number"
                        value={r.expected_minutes ?? avgMin}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setRows((p) =>
                            p.map((x) => (x.id === r.id ? ({ ...x, expected_minutes: v } as any) : x))
                          );
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none"
                      />
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">مجاني؟</div>
                      <select
                        value={r.is_free ? "free" : "paid"}
                        onChange={(e) => {
                          const isFree = e.target.value === "free";
                          setRows((p) => p.map((x) => (x.id === r.id ? ({ ...x, is_free: isFree } as any) : x)));
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none"
                      >
                        <option value="free">مجاني</option>
                        <option value="paid">مدفوع</option>
                      </select>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">السعر</div>
                      <input
                        type="number"
                        value={r.price ?? 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setRows((p) => p.map((x) => (x.id === r.id ? ({ ...x, price: v } as any) : x)));
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none"
                        disabled={!!r.is_free}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        try {
                          setErr(null);
                          const current = rows.find((x) => x.id === r.id);
                          await updateRow(r.id, {
                            expected_minutes: current?.expected_minutes ?? avgMin,
                            is_free: current?.is_free ?? false,
                            price: (current?.is_free ? 0 : current?.price) ?? current?.price ?? 0,
                            currency: current?.currency ?? "SAR",
                            status: "called",
                            called_at: new Date().toISOString(),
                          } as any);
                        } catch (e: any) {
                          setErr(e?.message ?? "Error");
                        }
                      }}
                      className="rounded-xl border border-amber-700 bg-amber-900/20 px-3 py-2 text-sm font-extrabold text-amber-200 hover:bg-amber-900/30"
                    >
                      Call
                    </button>

                    <Link
                      href={`/clinic/${r.id}`}
                      className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm font-extrabold text-slate-200 hover:bg-slate-900"
                    >
                      فتح الغرفة ➜
                    </Link>

                    <button
                      onClick={async () => {
                        try {
                          setErr(null);
                          await updateRow(r.id, {
                            status: "in_session",
                            started_at: new Date().toISOString(),
                          } as any);
                        } catch (e: any) {
                          setErr(e?.message ?? "Error");
                        }
                      }}
                      className="rounded-xl border border-emerald-700 bg-emerald-900/20 px-3 py-2 text-sm font-extrabold text-emerald-200 hover:bg-emerald-900/30"
                    >
                      Start
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          setErr(null);
                          await updateRow(r.id, {
                            status: "done",
                            ended_at: new Date().toISOString(),
                          } as any);
                        } catch (e: any) {
                          setErr(e?.message ?? "Error");
                        }
                      }}
                      className="rounded-xl border border-slate-700 bg-slate-900/30 px-3 py-2 text-sm font-extrabold text-slate-200 hover:bg-slate-900/50"
                    >
                      End
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="font-bold mb-2">مساعدة</div>
          <div className="text-sm text-slate-300 leading-relaxed">
            - “Call” ينقل الحالة إلى <span className="font-bold">called</span> <br />
            - “Start” ينقل إلى <span className="font-bold">in_session</span> <br />
            - “End” ينقل إلى <span className="font-bold">done</span> <br />
            <div className="mt-3 text-xs text-slate-400">
              كل العمليات تعتمد على RLS في consultation_queue كما هو عندك.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
