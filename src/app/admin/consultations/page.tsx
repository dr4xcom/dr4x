// src/app/admin/consultations/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type ConsultationRow = {
  id: string | number;
  patient_id?: string | null;
  doctor_id?: string | null;
  status?: string | null;
  scheduled_time?: string | null;
  session_link?: string | null;
  price?: number | null;
  created_at?: string | null;
};

type QueueRow = {
  id: string | number; // عندك UUID غالبًا
  patient_id?: string | null;
  doctor_id?: string | null;
  status?: string | null;
  position?: number | null;
  expected_minutes?: number | null;
  is_free?: boolean | null;
  price?: number | null;
  currency?: string | null;
  requested_at?: string | null;
  called_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  canceled_at?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

function badgeClass(kind: "neutral" | "ok" | "warn" | "bad") {
  switch (kind) {
    case "ok":
      return "border-emerald-900/50 bg-emerald-950/40 text-emerald-200";
    case "warn":
      return "border-amber-900/50 bg-amber-950/40 text-amber-200";
    case "bad":
      return "border-red-900/50 bg-red-950/40 text-red-200";
    default:
      return "border-slate-800 bg-slate-950/40 text-slate-200";
  }
}

function statusKind(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (!s) return "neutral";
  if (["done", "completed", "closed", "resolved", "finished"].includes(s)) return "ok";
  if (["pending", "waiting", "queued", "in_queue", "new"].includes(s)) return "warn";
  if (["cancelled", "canceled", "rejected", "failed"].includes(s)) return "bad";
  return "neutral";
}

export default function AdminConsultationsPage() {
  const [tab, setTab] = useState<"consultations" | "queue">("consultations");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileRow>>({});

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const PAGE_SIZE = 60;
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        if (tab === "consultations") {
          let query = supabase
            .from("consultations")
            .select("id,patient_id,doctor_id,status,scheduled_time,session_link,price,created_at")
            .order("created_at", { ascending: false })
            .range(from, to);

          if (statusFilter !== "all") query = query.eq("status", statusFilter);

          const { data, error } = await query;
          if (error) throw error;

          const list = (data ?? []) as ConsultationRow[];
          if (!alive) return;

          setConsultations((prev) => (page === 0 ? list : [...prev, ...list]));

          const ids = Array.from(
            new Set(
              list
                .flatMap((c) => [c.patient_id, c.doctor_id])
                .filter(Boolean) as string[]
            )
          );

          if (ids.length) {
            const { data: profs, error: profErr } = await supabase
              .from("profiles")
              .select("id,username,full_name,email,whatsapp_number")
              .in("id", ids);

            if (profErr) throw profErr;

            const map: Record<string, ProfileRow> = {};
            (profs ?? []).forEach((p: any) => {
              if (p?.id) map[p.id] = p as ProfileRow;
            });

            if (!alive) return;
            setProfilesMap((prev) => ({ ...prev, ...map }));
          }
        } else {
          // ✅ consultation_queue عندك ما فيه consultation_id
          let query = supabase
            .from("consultation_queue")
            .select(
              "id,patient_id,doctor_id,status,position,expected_minutes,is_free,price,currency,requested_at,called_at,started_at,ended_at,canceled_at,note,created_at,updated_at"
            )
            .order("created_at", { ascending: false })
            .range(from, to);

          if (statusFilter !== "all") query = query.eq("status", statusFilter);

          const { data, error } = await query;
          if (error) throw error;

          const list = (data ?? []) as QueueRow[];
          if (!alive) return;

          setQueue((prev) => (page === 0 ? list : [...prev, ...list]));

          const ids = Array.from(
            new Set(
              list
                .flatMap((c) => [c.patient_id, c.doctor_id])
                .filter(Boolean) as string[]
            )
          );

          if (ids.length) {
            const { data: profs, error: profErr } = await supabase
              .from("profiles")
              .select("id,username,full_name,email,whatsapp_number")
              .in("id", ids);

            if (profErr) throw profErr;

            const map: Record<string, ProfileRow> = {};
            (profs ?? []).forEach((p: any) => {
              if (p?.id) map[p.id] = p as ProfileRow;
            });

            if (!alive) return;
            setProfilesMap((prev) => ({ ...prev, ...map }));
          }
        }

        if (!alive) return;
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(
          e?.message ??
            "حدث خطأ أثناء جلب الاستشارات/الطابور. (قد تكون صلاحيات RLS لا تسمح بالعرض للأدمن)."
        );
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [tab, page, statusFilter]);

  const rows = tab === "consultations" ? consultations : queue;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((r: any) => {
      const id = String(r.id ?? "").toLowerCase();
      const status = String(r.status ?? "").toLowerCase();
      const pid = String(r.patient_id ?? "").toLowerCase();
      const did = String(r.doctor_id ?? "").toLowerCase();

      const pp = r.patient_id ? profilesMap[r.patient_id] : null;
      const dp = r.doctor_id ? profilesMap[r.doctor_id] : null;

      const pFull = (pp?.full_name ?? "").toLowerCase();
      const pUser = (pp?.username ?? "").toLowerCase();
      const pEmail = (pp?.email ?? "").toLowerCase();

      const dFull = (dp?.full_name ?? "").toLowerCase();
      const dUser = (dp?.username ?? "").toLowerCase();
      const dEmail = (dp?.email ?? "").toLowerCase();

      return (
        id.includes(needle) ||
        status.includes(needle) ||
        pid.includes(needle) ||
        did.includes(needle) ||
        pFull.includes(needle) ||
        pUser.includes(needle) ||
        pEmail.includes(needle) ||
        dFull.includes(needle) ||
        dUser.includes(needle) ||
        dEmail.includes(needle)
      );
    });
  }, [q, rows, profilesMap]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r: any) => {
      const s = (r?.status ?? "").toString().trim();
      if (s) set.add(s);
    });
    return ["all", ...Array.from(set)];
  }, [rows]);

  function resetAndSwitch(nextTab: "consultations" | "queue") {
    setTab(nextTab);
    setPage(0);
    setErr(null);
    setQ("");
    setStatusFilter("all");
    setConsultations([]);
    setQueue([]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Admin</div>
          <h2 className="text-lg font-extrabold">الاستشارات</h2>
          <div className="text-sm text-slate-300">
            عرض الاستشارات + طابور الانتظار (consultation_queue) + بحث/فلترة — بدون أي تعديل DB/RLS.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => resetAndSwitch("consultations")}
              className={[
                "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                tab === "consultations"
                  ? "border-slate-200 bg-slate-200 text-slate-950"
                  : "border-slate-800 bg-slate-950/40 text-slate-200 hover:bg-slate-900/40",
              ].join(" ")}
            >
              الاستشارات
            </button>
            <button
              type="button"
              onClick={() => resetAndSwitch("queue")}
              className={[
                "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                tab === "queue"
                  ? "border-slate-200 bg-slate-200 text-slate-950"
                  : "border-slate-800 bg-slate-950/40 text-slate-200 hover:bg-slate-900/40",
              ].join(" ")}
            >
              الطابور
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(0);
              setErr(null);
              if (tab === "consultations") setConsultations([]);
              else setQueue([]);
              setStatusFilter(e.target.value);
            }}
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
            title="فلترة حسب الحالة"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "كل الحالات" : s}
              </option>
            ))}
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث (ID/Status/مريض/طبيب)…"
            className="w-full sm:w-72 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
          />
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold">
            {tab === "consultations" ? "قائمة الاستشارات" : "قائمة الطابور"}
          </div>
          <div className="text-xs text-slate-400">
            المعروض: {filtered.length} {loading ? "• جارٍ التحميل…" : ""}
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">جارٍ جلب البيانات…</div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">لا توجد نتائج.</div>
        ) : null}

        <div className="divide-y divide-slate-800">
          {filtered.map((r: any) => {
            const p = r.patient_id ? profilesMap[r.patient_id] : null;
            const d = r.doctor_id ? profilesMap[r.doctor_id] : null;

            const status = (r.status ?? null) as string | null;
            const kind = statusKind(status) as any;

            return (
              <div key={`${tab}-${r.id}`} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-extrabold">
                        {tab === "consultations" ? "Consultation" : "Queue Item"} #{String(r.id)}
                      </div>

                      <span
                        className={[
                          "text-xs font-bold rounded-full px-2 py-1 border",
                          badgeClass(kind),
                        ].join(" ")}
                      >
                        {safeText(status)}
                      </span>

                      {tab === "consultations" && r.scheduled_time ? (
                        <span className="text-xs text-slate-500">
                          scheduled_time: {safeText(r.scheduled_time)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-500">المريض:</span>{" "}
                        <span className="font-semibold">
                          {p?.full_name?.trim() ? p.full_name : safeText(r.patient_id)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">طبيب:</span>{" "}
                        <span className="font-semibold">
                          {d?.full_name?.trim() ? d.full_name : safeText(r.doctor_id)}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500">created_at:</span>{" "}
                        <span className="font-semibold">{safeText(r.created_at)}</span>
                      </div>

                      {tab === "queue" ? (
                        <>
                          <div>
                            <span className="text-slate-500">position:</span>{" "}
                            <span className="font-semibold">{r.position ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">expected_minutes:</span>{" "}
                            <span className="font-semibold">{r.expected_minutes ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">is_free:</span>{" "}
                            <span className="font-semibold">
                              {typeof r.is_free === "boolean" ? (r.is_free ? "true" : "false") : "—"}
                            </span>
                          </div>
                          <div className="sm:col-span-2 lg:col-span-3">
                            <span className="text-slate-500">note:</span>{" "}
                            <span className="font-semibold">{safeText(r.note)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-slate-500">session_link:</span>{" "}
                            <span className="font-semibold">{safeText(r.session_link)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">price:</span>{" "}
                            <span className="font-semibold">
                              {typeof r.price === "number" ? r.price : safeText(r.price)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                    <button
                      type="button"
                      disabled
                      className="rounded-xl border border-slate-900 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-600 cursor-not-allowed"
                      title="لاحقًا: فتح التفاصيل/تعيين طبيب/تحديث الحالة (قد يحتاج RPC حسب RLS)"
                    >
                      تفاصيل (قريبًا)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            ملاحظة: هذه الصفحة تعرض البيانات فقط. لو احتجنا “تعيين طبيب/تغيير حالة” وRLS تمنع UPDATE،
            سنثبت ذلك أولًا ثم نستخدم RPC بأقل تعديل ممكن.
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-semibold transition",
              loading
                ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                : "border-slate-800 bg-slate-900/40 text-slate-200 hover:bg-slate-900",
            ].join(" ")}
          >
            تحميل المزيد
          </button>
        </div>
      </div>
    </div>
  );
}
