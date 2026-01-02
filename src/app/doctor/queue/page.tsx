// src/app/doctor/queue/page.tsx

"use client";



import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/utils/supabase/client";

import { useRouter } from "next/navigation";



type QueueRow = {

  id: string; // uuid

  doctor_id: string | null;

  patient_id: string | null;

  status: string | null;

  position: number | null;

  expected_minutes: number | null;

  is_free: boolean | null;

  price: number | null;

  currency: string | null;

  requested_at: string | null;

  called_at: string | null;

  started_at: string | null;

  ended_at: string | null;

  canceled_at: string | null;

  note: string | null;

  created_at: string | null;

  updated_at: string | null;



  // ✅ int8 قد يرجع string من Supabase

  consultation_id: number | string | null;

};



type ConsultationRow = {

  id: number | string;

};



function safeText(v: any) {

  const s = typeof v === "string" ? v.trim() : "";

  return s.length ? s : "—";

}



function toIdString(v: number | string | null | undefined) {

  if (v == null) return "";

  const s = String(v).trim();

  return s;

}



function isLinked(v: number | string | null | undefined) {

  const s = toIdString(v);

  return s.length > 0 && s !== "0";

}



function badgeClass(status: string | null | undefined) {

  const s = (status ?? "").toLowerCase();

  if (!s) return "border-slate-800 bg-slate-950/40 text-slate-200";

  if (["done", "completed", "closed", "resolved", "finished"].includes(s))

    return "border-emerald-900/50 bg-emerald-950/40 text-emerald-200";

  if (["pending", "waiting", "queued", "in_queue", "new"].includes(s))

    return "border-amber-900/50 bg-amber-950/40 text-amber-200";

  if (["accepted", "called", "started", "active", "in_progress"].includes(s))

    return "border-sky-900/50 bg-sky-950/40 text-sky-200";

  if (["cancelled", "canceled", "rejected", "failed"].includes(s))

    return "border-red-900/50 bg-red-950/40 text-red-200";

  return "border-slate-800 bg-slate-950/40 text-slate-200";

}



export default function DoctorQueuePage() {

  const router = useRouter();



  const [loading, setLoading] = useState(true);

  const [actingId, setActingId] = useState<string | null>(null);

  const [err, setErr] = useState<string | null>(null);



  const [meId, setMeId] = useState<string | null>(null);



  const [rows, setRows] = useState<QueueRow[]>([]);

  const [q, setQ] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("all");



  useEffect(() => {

    let alive = true;



    (async () => {

      try {

        setErr(null);

        setLoading(true);



        const { data: uRes, error: uErr } = await supabase.auth.getUser();

        if (uErr) throw uErr;

        const uid = uRes?.user?.id ?? null;



        if (!alive) return;

        setMeId(uid);



        await refresh(uid);

        if (!alive) return;



        setLoading(false);

      } catch (e: any) {

        if (!alive) return;

        setErr(e?.message ?? "تعذر تحميل الطابور.");

        setLoading(false);

      }

    })();



    return () => {

      alive = false;

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);



  async function refresh(uid?: string | null) {

    setErr(null);



    const myId = typeof uid === "string" ? uid : meId;



    let query = supabase

      .from("consultation_queue")

      .select(

        "id,doctor_id,patient_id,status,position,expected_minutes,is_free,price,currency,requested_at,called_at,started_at,ended_at,canceled_at,note,created_at,updated_at,consultation_id"

      )

      .order("created_at", { ascending: true });



    if (myId) {

      query = query.or(`doctor_id.eq.${myId},doctor_id.is.null`);

    }



    const { data, error } = await query;

    if (error) throw error;



    setRows((data ?? []) as QueueRow[]);

  }



  const filtered = useMemo(() => {

    const needle = q.trim().toLowerCase();



    return rows.filter((r) => {

      if (statusFilter !== "all") {

        const st = (r.status ?? "").toLowerCase();

        if (st !== statusFilter.toLowerCase()) return false;

      }



      if (!needle) return true;



      const id = (r.id ?? "").toLowerCase();

      const pid = (r.patient_id ?? "").toLowerCase();

      const did = (r.doctor_id ?? "").toLowerCase();

      const st = (r.status ?? "").toLowerCase();

      const note = (r.note ?? "").toLowerCase();

      const cid = toIdString(r.consultation_id).toLowerCase();



      return (

        id.includes(needle) ||

        pid.includes(needle) ||

        did.includes(needle) ||

        st.includes(needle) ||

        note.includes(needle) ||

        cid.includes(needle)

      );

    });

  }, [rows, q, statusFilter]);



  async function accept(row: QueueRow) {

    if (!meId) {

      setErr("يجب تسجيل الدخول كطبيب أولاً.");

      return;

    }



    // ✅ إذا مربوط أصلاً باستشارة، افتح التفاصيل مباشرة (آمن للـ int8 string/number)

    if (isLinked(row.consultation_id)) {

      router.push(`/doctor/consultations/${toIdString(row.consultation_id)}`);

      return;

    }



    try {

      setErr(null);

      setActingId(row.id);



      if (row.doctor_id && row.doctor_id !== meId) {

        setErr("هذا الطلب معيّن لطبيب آخر.");

        setActingId(null);

        return;

      }



      if (!row.patient_id) {

        setErr("لا يمكن قبول الطلب لأنه لا يحتوي patient_id.");

        setActingId(null);

        return;

      }



      // 1) إنشاء الاستشارة (consultations)

      const insertPayload: any = {

        patient_id: row.patient_id,

        doctor_id: meId,

        scheduled_time: new Date().toISOString(),

        status: "scheduled",

      };



      if (row.is_free === true) {

        insertPayload.price = 0;

      } else if (typeof row.price === "number") {

        insertPayload.price = row.price;

      }



      const { data: cIns, error: cErr } = await supabase

        .from("consultations")

        .insert(insertPayload)

        .select("id")

        .single();



      if (cErr) throw cErr;



      const newConsultationId = (cIns as ConsultationRow)?.id;

      const newIdStr = toIdString(newConsultationId);

      if (!newIdStr) throw new Error("تم إنشاء الاستشارة لكن لم يصل id.");



      // 2) تحديث صف الطابور: تعيين الطبيب + ربط consultation_id + تحديث status

      const updPayload: any = {

        doctor_id: meId,

        consultation_id: newConsultationId,

        status: "accepted",

        called_at: new Date().toISOString(),

      };



      const { error: qErr } = await supabase

        .from("consultation_queue")

        .update(updPayload)

        .eq("id", row.id);



      if (qErr) throw qErr;



      // 3) تحديث الواجهة وفتح صفحة التفاصيل

      await refresh(meId);

      router.push(`/doctor/consultations/${newIdStr}`);

    } catch (e: any) {

      setErr(

        e?.message ??

          "فشل قبول الطلب. (غالبًا RLS تمنع INSERT في consultations أو UPDATE في consultation_queue)."

      );

    } finally {

      setActingId(null);

    }

  }



  return (

    <div className="space-y-4">

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">

        <div>

          <div className="text-xs text-slate-400">Doctor</div>

          <h2 className="text-lg font-extrabold">طابور الانتظار</h2>

          <div className="text-sm text-slate-300">

            عرض طلبات consultation_queue + زر “قبول” لإنشاء consultations وربطها — بدون أي تعديل DB/RLS.

          </div>

        </div>



        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">

          <select

            value={statusFilter}

            onChange={(e) => setStatusFilter(e.target.value)}

            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"

            title="فلترة الحالة"

          >

            <option value="all">كل الحالات</option>

            <option value="pending">pending</option>

            <option value="queued">queued</option>

            <option value="waiting">waiting</option>

            <option value="accepted">accepted</option>

            <option value="started">started</option>

            <option value="done">done</option>

            <option value="cancelled">cancelled</option>

          </select>



          <input

            value={q}

            onChange={(e) => setQ(e.target.value)}

            placeholder="بحث (ID/مريض/حالة/consultation_id)…"

            className="w-full sm:w-80 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"

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

          <div className="text-sm font-semibold">القائمة</div>

          <div className="text-xs text-slate-400">

            المعروض: {filtered.length} {loading ? "• جارٍ التحميل…" : ""}

          </div>

        </div>



        {loading && rows.length === 0 ? (

          <div className="p-4 text-sm text-slate-300">جارٍ جلب الطابور…</div>

        ) : null}



        {!loading && filtered.length === 0 ? (

          <div className="p-4 text-sm text-slate-300">لا توجد نتائج.</div>

        ) : null}



        <div className="divide-y divide-slate-800">

          {filtered.map((r) => {

            const st = safeText(r.status);

            const linked = isLinked(r.consultation_id);



            return (

              <div key={r.id} className="p-4">

                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <div className="text-sm font-extrabold">Queue #{safeText(r.id)}</div>



                      <span

                        className={[

                          "text-xs font-bold rounded-full px-2 py-1 border",

                          badgeClass(r.status),

                        ].join(" ")}

                      >

                        {st}

                      </span>



                      {linked ? (

                        <span className="text-xs font-bold rounded-full px-2 py-1 border border-emerald-900/50 bg-emerald-950/40 text-emerald-200">

                          مربوط باستشارة: #{toIdString(r.consultation_id)}

                        </span>

                      ) : null}

                    </div>



                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-300">

                      <div>

                        <span className="text-slate-500">patient_id:</span>{" "}

                        <span className="font-semibold break-all">{safeText(r.patient_id)}</span>

                      </div>

                      <div>

                        <span className="text-slate-500">doctor_id:</span>{" "}

                        <span className="font-semibold break-all">{safeText(r.doctor_id)}</span>

                      </div>

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

                          {r.is_free == null ? "—" : r.is_free ? "yes" : "no"}

                        </span>

                      </div>

                      <div>

                        <span className="text-slate-500">price:</span>{" "}

                        <span className="font-semibold">

                          {r.price == null ? "—" : r.price} {safeText(r.currency)}

                        </span>

                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">

                        <span className="text-slate-500">note:</span>{" "}

                        <span className="font-semibold break-words">{safeText(r.note)}</span>

                      </div>

                    </div>

                  </div>



                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">

                    <button

                      type="button"

                      onClick={() => accept(r)}

                      disabled={actingId === r.id}

                      className={[

                        "rounded-xl border px-3 py-2 text-sm font-extrabold transition",

                        actingId === r.id

                          ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"

                          : linked

                          ? "border-sky-900/50 bg-sky-950/40 text-sky-200 hover:bg-sky-950/60"

                          : "border-emerald-900/50 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-950/60",

                      ].join(" ")}

                      title={

                        linked

                          ? "فتح تفاصيل الاستشارة المرتبطة"

                          : "قبول الطلب: إنشاء consultation وربطها داخل queue"

                      }

                    >

                      {actingId === r.id ? "…" : linked ? "فتح التفاصيل" : "قبول"}

                    </button>



                    <button

                      type="button"

                      onClick={() => refresh(meId)}

                      disabled={loading || actingId != null}

                      className={[

                        "rounded-xl border px-3 py-2 text-sm font-semibold transition",

                        loading || actingId != null

                          ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"

                          : "border-slate-800 bg-slate-900/40 text-slate-200 hover:bg-slate-900",

                      ].join(" ")}

                    >

                      تحديث

                    </button>

                  </div>

                </div>

              </div>

            );

          })}

        </div>



        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">

          ملاحظة: زر “قبول” يجرب INSERT في consultations ثم UPDATE في consultation_queue.

          إذا فشل بسبب RLS سنثبت ذلك برسالة الخطأ، وبعدها فقط نعمل RPC ضيق جدًا (بدون فتح سياسات واسعة).

        </div>

      </div>

    </div>

  );

}

