"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Department = {
  id: number;
  name_ar: string | null;
  name_en: string | null;
};

type Specialty = {
  id: number;
  department_id: number | null;
  name_ar: string | null;
  name_en: string | null;
};

type DoctorRow = {
  profile_id: string;
  specialty_id: number | null;
  rank_id: number | null;
  is_approved: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  whatsapp_number: string | null;
  is_doctor: boolean | null;
};

type DoctorStatus = "available" | "busy" | "calling";

type DoctorView = {
  profile_id: string;
  full_name: string;
  username: string;
  whatsapp_number: string;
  rank_id: number | null;
  specialty_id: number | null;
  status: DoctorStatus;
};

type QueueRequestInfo = {
  id?: string;
  requested_at?: string | null;
  expected_minutes?: number | null;
  position?: number | null;
  is_free?: boolean | null;
  price?: number | null;
  currency?: string | null;
  status?: string | null;
};

type DoctorQueueSnapshotRow = {
  doctor_id: string | null;
  called_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  canceled_at: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function pickName(ar?: string | null, en?: string | null) {
  const a = (ar ?? "").trim();
  const e = (en ?? "").trim();
  return a || e || "—";
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function statusLabel(s: DoctorStatus) {
  // i18n: استبدل لاحقًا بمفاتيح ترجمة
  if (s === "busy") return "مشغول";
  if (s === "calling") return "قيد النداء";
  return "متواجد";
}

function computeDoctorStatusFromQueue(rows: DoctorQueueSnapshotRow[]): DoctorStatus {
  // ✅ بدون تخمين status النصي — نعتمد على أعمدة الوقت المؤكدة لديك
  // Busy: started_at موجود + ended_at فارغ + canceled_at فارغ
  const hasBusy = rows.some(
    (r) => !!r.started_at && !r.ended_at && !r.canceled_at
  );
  if (hasBusy) return "busy";

  // Calling: called_at موجود + started_at فارغ + ended_at فارغ + canceled_at فارغ
  const hasCalling = rows.some(
    (r) => !!r.called_at && !r.started_at && !r.ended_at && !r.canceled_at
  );
  if (hasCalling) return "calling";

  return "available";
}

export default function PatientRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const [meId, setMeId] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctorsRaw, setDoctorsRaw] = useState<DoctorRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileRow>>({});

  // حالة الأطباء حسب consultation_queue (طريقة #2 التي اخترتها)
  const [doctorStatusMap, setDoctorStatusMap] = useState<Record<string, DoctorStatus>>({});

  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [specialtyId, setSpecialtyId] = useState<number | "">("");
  const [doctorId, setDoctorId] = useState<string>("");

  const [note, setNote] = useState<string>("");

  const [requestInfo, setRequestInfo] = useState<QueueRequestInfo | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        // 1) لازم يكون فيه مستخدم داخل
        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;

        const uid = uRes?.user?.id ?? null;
        if (!uid) {
          router.push("/auth/login");
          return;
        }
        if (!alive) return;
        setMeId(uid);

        // 2) تحميل التخصصات الرئيسية (departments)
        const { data: depData, error: depErr } = await supabase
          .from("departments")
          .select("id,name_ar,name_en")
          .order("id", { ascending: true });

        if (depErr) throw depErr;
        if (!alive) return;
        setDepartments((depData ?? []) as Department[]);

        // 3) تحميل التخصصات الدقيقة (specialties)
        const { data: spData, error: spErr } = await supabase
          .from("specialties")
          .select("id,department_id,name_ar,name_en")
          .order("id", { ascending: true });

        if (spErr) throw spErr;
        if (!alive) return;
        setSpecialties((spData ?? []) as Specialty[]);

        // 4) تحميل الأطباء المعتمدين من جدول doctors
        const { data: dData, error: dErr } = await supabase
          .from("doctors")
          .select("profile_id,specialty_id,rank_id,is_approved")
          .eq("is_approved", true);

        if (dErr) throw dErr;

        const doctors = (dData ?? []) as DoctorRow[];
        if (!alive) return;
        setDoctorsRaw(doctors);

        // 5) تحميل بياناتهم من profiles
        const ids = Array.from(
          new Set(
            doctors
              .map((d) => (typeof d.profile_id === "string" ? d.profile_id : ""))
              .filter(Boolean)
          )
        );

        if (ids.length) {
          const { data: pData, error: pErr } = await supabase
            .from("profiles")
            .select("id,full_name,username,whatsapp_number,is_doctor")
            .in("id", ids);

          if (pErr) throw pErr;

          const map: Record<string, ProfileRow> = {};
          for (const p of (pData ?? []) as ProfileRow[]) {
            map[p.id] = p;
          }
          if (!alive) return;
          setProfilesMap(map);
        } else {
          if (!alive) return;
          setProfilesMap({});
        }

        // 6) تحديد حالة الأطباء من consultation_queue (اختيارك #2)
        // نقرأ الصفوف "الحديثة" للأطباء المعروضين فقط — بدون تخمين status النصي
        // ملاحظة: إذا RLS تمنع القراءة، لن نفشل الصفحة، فقط نعتبرهم "متواجد"
        if (ids.length) {
          const { data: qData, error: qErr } = await supabase
            .from("consultation_queue")
            .select("doctor_id,called_at,started_at,ended_at,canceled_at,updated_at,created_at")
            .in("doctor_id", ids);

          if (!qErr && qData) {
            const rows = (qData ?? []) as DoctorQueueSnapshotRow[];
            const grouped: Record<string, DoctorQueueSnapshotRow[]> = {};
            for (const r of rows) {
              const did = (r.doctor_id ?? "").trim();
              if (!did) continue;
              if (!grouped[did]) grouped[did] = [];
              grouped[did].push(r);
            }

            const sMap: Record<string, DoctorStatus> = {};
            for (const did of ids) {
              const rr = grouped[did] ?? [];
              sMap[did] = computeDoctorStatusFromQueue(rr);
            }
            if (!alive) return;
            setDoctorStatusMap(sMap);
          } else {
            if (!alive) return;
            setDoctorStatusMap({});
          }
        } else {
          if (!alive) return;
          setDoctorStatusMap({});
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر تحميل البيانات.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const specialtiesByDepartment: Specialty[] = useMemo(() => {
    if (departmentId === "") return [];
    const did = Number(departmentId);
    return specialties
      .filter((s) => (s.department_id ?? null) === did)
      .sort((a, b) =>
        pickName(a.name_ar, a.name_en).localeCompare(pickName(b.name_ar, b.name_en), "ar")
      );
  }, [specialties, departmentId]);

  const doctorsBySpecialty: DoctorView[] = useMemo(() => {
    if (specialtyId === "") return [];

    const sid = Number(specialtyId);

    return doctorsRaw
      .filter((d) => d.specialty_id === sid && d.is_approved === true)
      .map((d) => {
        const p = profilesMap[d.profile_id];
        const full = (p?.full_name ?? "").trim();
        const user = (p?.username ?? "").trim();
        const wa = (p?.whatsapp_number ?? "").trim();

        const st = doctorStatusMap[d.profile_id] ?? "available";

        return {
          profile_id: d.profile_id,
          full_name: full || user || "طبيب",
          username: user || "—",
          whatsapp_number: wa || "—",
          rank_id: d.rank_id ?? null,
          specialty_id: d.specialty_id ?? null,
          status: st,
        };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
  }, [doctorsRaw, profilesMap, specialtyId, doctorStatusMap]);

  const selectedDepartmentName = useMemo(() => {
    if (departmentId === "") return "—";
    const d = departments.find((x) => x.id === Number(departmentId));
    return pickName(d?.name_ar, d?.name_en);
  }, [departments, departmentId]);

  const selectedSpecialtyName = useMemo(() => {
    if (specialtyId === "") return "—";
    const s = specialties.find((x) => x.id === Number(specialtyId));
    return pickName(s?.name_ar, s?.name_en);
  }, [specialties, specialtyId]);

  const selectedDoctorStatus = useMemo(() => {
    if (!doctorId) return null;
    const d = doctorsBySpecialty.find((x) => x.profile_id === doctorId);
    return d?.status ?? null;
  }, [doctorId, doctorsBySpecialty]);

  async function submitRequest() {
    setErr("");
    setSuccessMsg("");
    setRequestInfo(null);

    try {
      if (!meId) throw new Error("يجب تسجيل الدخول أولاً.");
      if (departmentId === "") throw new Error("اختر التخصص الرئيسي أولاً.");
      if (specialtyId === "") throw new Error("اختر التخصص الدقيق أولاً.");
      if (!doctorId) throw new Error("اختر الطبيب أولاً (إلزامي).");

      // تأكيد أن الطبيب فعلاً ضمن قائمة الأطباء المعتمدين لهذا التخصص الدقيق
      const ok = doctorsBySpecialty.some((d) => d.profile_id === doctorId);
      if (!ok) throw new Error("الطبيب المختار غير صالح لهذا التخصص أو غير معتمد.");

      setBusy(true);

      // إنشاء صف في consultation_queue
      const nowIso = new Date().toISOString();
      const payload: any = {
        patient_id: meId,
        doctor_id: doctorId,
        status: "pending",
        requested_at: nowIso,
      };

      const cleanNote = note.trim();
      if (cleanNote) payload.note = cleanNote;

      const { error: insErr } = await supabase.from("consultation_queue").insert(payload);
      if (insErr) throw insErr;

      // نحاول قراءة نفس الطلب لإظهار requested_at + expected_minutes
      const { data: qRow, error: qErr } = await supabase
        .from("consultation_queue")
        .select("id,requested_at,expected_minutes,position,is_free,price,currency,status,created_at")
        .eq("patient_id", meId)
        .eq("doctor_id", doctorId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!qErr && qRow) {
        setRequestInfo({
          id: (qRow as any).id ?? undefined,
          requested_at: (qRow as any).requested_at ?? null,
          expected_minutes: (qRow as any).expected_minutes ?? null,
          position: (qRow as any).position ?? null,
          is_free: (qRow as any).is_free ?? null,
          price: (qRow as any).price ?? null,
          currency: (qRow as any).currency ?? null,
          status: (qRow as any).status ?? null,
        });
      } else {
        // حتى لو ما قدرنا نقرأ بسبب RLS، لا نفشل العملية
        setRequestInfo({
          requested_at: nowIso,
        });
      }

      // تنظيف + رسالة نجاح داخل الصفحة
      setNote("");
      setDoctorId("");
      setSuccessMsg("✅ تم إرسال طلبك إلى الطابور بنجاح.");
    } catch (e: any) {
      setErr(e?.message ?? "فشل إرسال الطلب. (قد يكون بسبب RLS)");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="p-6">جاري التحميل…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">طلب استشارة</h1>
          <div className="mt-2 text-sm text-slate-600">
            اختر التخصص الرئيسي ثم التخصص الدقيق ثم الطبيب (إلزامي) — بعدها يتم إنشاء صف في{" "}
            <span className="font-mono">consultation_queue</span>.
          </div>
        </div>

        <button
          onClick={() => router.push("/home")}
          className="rounded-xl px-4 py-2 border border-slate-200 hover:bg-slate-50"
        >
          الرجوع
        </button>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {err}
        </div>
      ) : null}

      {successMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-2">
          <div className="font-semibold">{successMsg}</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-white p-3">
              <div className="text-xs text-slate-500">وقت الطلب (requested_at)</div>
              <div className="font-semibold">{fmtDateTime(requestInfo?.requested_at)}</div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-3">
              <div className="text-xs text-slate-500">وقت الانتظار المتوقع (expected_minutes)</div>
              <div className="font-semibold">
                {requestInfo?.expected_minutes == null ? "—" : `${requestInfo.expected_minutes} دقيقة`}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-3">
              <div className="text-xs text-slate-500">ترتيبك في الطابور (position)</div>
              <div className="font-semibold">{requestInfo?.position == null ? "—" : requestInfo.position}</div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-3">
              <div className="text-xs text-slate-500">السعر</div>
              <div className="font-semibold">
                {requestInfo?.is_free === true
                  ? "مجاني"
                  : requestInfo?.price == null
                  ? "—"
                  : `${requestInfo.price} ${requestInfo.currency ?? ""}`.trim()}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600">
            * إذا ظهرت الشرطات (—) فهذا يعني أن الحقول لم تُقرأ (قد يكون بسبب RLS) أو لم تُملأ تلقائيًا داخل قاعدة البيانات.
          </div>
        </div>
      ) : null}

      {/* 1) التخصص الرئيسي */}
      <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="text-lg font-semibold">1) اختر التخصص الرئيسي</div>

        <select
          value={departmentId}
          onChange={(e) => {
            const v = e.target.value;
            const did = v ? Number(v) : "";
            setDepartmentId(did);
            // تغيير التخصص الرئيسي => نعيد ضبط التخصص الدقيق والطبيب
            setSpecialtyId("");
            setDoctorId("");
            setErr("");
            setSuccessMsg("");
            setRequestInfo(null);
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"
        >
          <option value="">— اختر تخصص رئيسي —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {pickName(d.name_ar, d.name_en)}
            </option>
          ))}
        </select>

        <div className="text-sm text-slate-500">
          التخصص الرئيسي المختار:{" "}
          <span className="font-semibold text-slate-900">{selectedDepartmentName}</span>
        </div>
      </div>

      {/* 2) التخصص الدقيق */}
      <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="text-lg font-semibold">2) اختر التخصص الدقيق</div>

        {departmentId === "" ? (
          <div className="text-sm text-slate-500">اختر التخصص الرئيسي أولاً ليظهر التخصص الدقيق.</div>
        ) : specialtiesByDepartment.length === 0 ? (
          <div className="text-sm text-amber-700">لا يوجد تخصصات دقيقة داخل هذا القسم حالياً.</div>
        ) : (
          <select
            value={specialtyId}
            onChange={(e) => {
              const v = e.target.value;
              setSpecialtyId(v ? Number(v) : "");
              setDoctorId("");
              setErr("");
              setSuccessMsg("");
              setRequestInfo(null);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"
          >
            <option value="">— اختر تخصص دقيق —</option>
            {specialtiesByDepartment.map((s) => (
              <option key={s.id} value={s.id}>
                {pickName(s.name_ar, s.name_en)}
              </option>
            ))}
          </select>
        )}

        <div className="text-sm text-slate-500">
          التخصص الدقيق المختار:{" "}
          <span className="font-semibold text-slate-900">{selectedSpecialtyName}</span>
        </div>
      </div>

      {/* 3) اختيار الطبيب */}
      <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="text-lg font-semibold">3) اختر الطبيب (إلزامي)</div>

        {specialtyId === "" ? (
          <div className="text-sm text-slate-500">اختر التخصص الدقيق أولاً ليظهر الأطباء.</div>
        ) : doctorsBySpecialty.length === 0 ? (
          <div className="text-sm text-amber-700">لا يوجد أطباء معتمدون داخل هذا التخصص حالياً.</div>
        ) : (
          <select
            value={doctorId}
            onChange={(e) => {
              setDoctorId(e.target.value);
              setErr("");
              setSuccessMsg("");
              setRequestInfo(null);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"
          >
            <option value="">— اختر طبيب —</option>
            {doctorsBySpecialty.map((d) => (
              <option key={d.profile_id} value={d.profile_id}>
                {d.full_name} (@{d.username}) — {statusLabel(d.status)}
              </option>
            ))}
          </select>
        )}

        {doctorId ? (
          <div className="text-xs text-slate-500">
            doctor_id الذي سيتم حفظه في الطابور: <span className="font-mono">{doctorId}</span>
            {selectedDoctorStatus ? (
              <>
                {" "}
                — الحالة: <span className="font-semibold">{statusLabel(selectedDoctorStatus)}</span>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="text-xs text-slate-500">
          * حالة الطبيب هنا محسوبة من <span className="font-mono">consultation_queue</span> عبر الأعمدة:
          <span className="font-mono"> called_at / started_at / ended_at / canceled_at</span>.
          (بدون الاعتماد على نص <span className="font-mono">status</span>)
        </div>
      </div>

      {/* ملاحظة */}
      <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="text-lg font-semibold">ملاحظة للمستشفى/الطبيب (اختياري)</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full min-h-[110px] rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"
          placeholder="اكتب وصف مختصر للحالة…"
        />
      </div>

      {/* إرسال */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={submitRequest}
          disabled={busy || departmentId === "" || specialtyId === "" || !doctorId}
          className="rounded-xl px-5 py-3 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
          title={!doctorId ? "اختيار الطبيب إلزامي" : "إرسال الطلب"}
        >
          {busy ? "جاري الإرسال…" : "إرسال الطلب"}
        </button>
      </div>

      <div className="text-xs text-slate-500">
        * i18n: استبدل النصوص بمفاتيح الترجمة حسب نظام تعدد اللغات عندك.
      </div>
    </div>
  );
}
