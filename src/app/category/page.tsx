// src/app/category/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  getSystemSettingNumber,
  getSystemSettingString,
} from "@/utils/systemSettings";
import { Video, UserCircle2 } from "lucide-react";
import ConsultationChat from "@/components/clinic/ConsultationChat";

/* ====================== أنواع مساعدة ====================== */

type ClinicSettings = {
  emergencyHours: string;
  emergencyPrice: number | null;
  deptDefaultHours: string;
  deptDefaultPrice: number | null;
};

type Department = {
  id: string;
  name: string;
};

// doctor_id هنا نعتبره نفس profile_id (هو معرف الطبيب في consultation_queue)
type DoctorRow = {
  doctor_id: string;
  profile_id: string;
  full_name: string;
  username: string | null;
  rank_name: string | null;
  specialty_name: string | null;
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

function inferLabel(row: any): string {
  const candidates = [
    row?.name_ar,
    row?.title_ar,
    row?.label_ar,
    row?.name_en,
    row?.title_en,
    row?.label_en,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  if (row && row.name_ar && typeof row.name_ar === "string") return row.name_ar;
  if (row && row.name_en && typeof row.name_en === "string") return row.name_en;
  if (row && row.id != null) return String(row.id);
  return "غير معرّف";
}

/* ====================== صفحة اختيار القسم (بدون بارامترات) ====================== */

function CategoryLandingPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<ClinicSettings>({
    emergencyHours: "طوارئ 24 ساعة",
    emergencyPrice: null,
    deptDefaultHours: "من 4:00 م إلى 10:00 م",
    deptDefaultPrice: null,
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const [eHours, ePrice, dHours, dPrice] = await Promise.all([
          getSystemSettingString("clinic_emergency_hours", "طوارئ 24 ساعة"),
          getSystemSettingNumber("clinic_emergency_price"),
          getSystemSettingString(
            "clinic_dept_default_hours",
            "من 4:00 م إلى 10:00 م"
          ),
          getSystemSettingNumber("clinic_dept_default_price"),
        ]);

        if (!alive) return;

        setSettings({
          emergencyHours: (eHours || "طوارئ 24 ساعة").trim(),
          emergencyPrice: ePrice,
          deptDefaultHours: (dHours || "من 4:00 م إلى 10:00 م").trim(),
          deptDefaultPrice: dPrice,
        });

        const { data, error } = await supabase.from("departments").select("*");

        if (error) {
          console.error("departments error", error);
          setErr("تعذر تحميل الأقسام من قاعدة البيانات (تحقق من صلاحيات RLS).");
        } else if (data && data.length > 0) {
          const mapped: Department[] = (data as any[]).map((row) => {
            const name =
              (row.name as string) ||
              (row.title as string) ||
              (row.ar_name as string) ||
              (row.en_name as string) ||
              (row.slug as string) ||
              "قسم طبي";
            return {
              id: String(row.id),
              name,
            };
          });
          setDepartments(mapped);
        } else {
          setDepartments([]);
        }
      } catch (e: any) {
        if (!alive) return;
        console.error(e);
        setErr(e?.message ?? "تعذر تحميل التخصصات.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const emergencyPriceLabel =
    settings.emergencyPrice == null
      ? "يتم تحديد السعر من قِبل الإدارة"
      : `${settings.emergencyPrice} ريال`;

  const deptPriceLabel =
    settings.deptDefaultPrice == null
      ? "السعر حسب القسم"
      : `ابتداءً من ${settings.deptDefaultPrice} ريال`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center py-6 px-3">
      <div className="relative w-full max-w-6xl rounded-[32px] border border-pink-500/70 bg-slate-950 shadow-[0_0_45px_rgba(236,72,153,0.35)] overflow-hidden">
        {/* شريط علوي */}
        <div className="flex items-center justify_between gap-3 border-b border-slate-800 bg-slate-900/60 px-4 sm:px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
          >
            الرجوع للرئيسية
          </button>

          <div className="text-center">
            <div className="text-xs text-emerald-300 tracking-wide">
              Doctor · Clinic
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold">
              التخصصات الطبية وعياداتنا
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 mt-1">
              اختر القسم المناسب لك، وتعرّف على أوقات العمل والأسعار قبل الحجز.
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex items_center gap-2 cursor-pointer"
          >
            <div className="h-10 w-10 rounded-full bg-slate-900 border border-pink-500/60 grid place-items-center text-xs font-extrabold">
              DR4X
            </div>
          </button>
        </div>

        {/* محتوى الصفحة */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-[2fr,1fr] px-4 sm:px-8 py-5">
          {/* يسار: الطوارئ + الأقسام */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                router.push("/patient/emergency");
              }}
              className="w-full rounded-3xl border border-pink-500/80 bg-gradient-to-l from-rose-600/60 via-fuchsia-600/60 to-sky-500/50 px-5 py-4 sm:py-5 text-start shadow-[0_0_35px_rgba(236,72,153,0.55)] hover:brightness-110 transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm sm:text-base">
                <div>
                  <div className="text-xs text-slate-100/80 mb-1">
                    قسم خاص للحالات العاجلة
                  </div>
                  <div className="text-lg sm:text-2xl font-extrabold">
                    عيادة <span className="text-emerald-200">الطوارئ</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-100/90 mt-1">
                    {settings.emergencyHours}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-100/70">سعر الكشف</div>
                  <div className="text-base sm:text-xl font-extrabold">
                    {emergencyPriceLabel}
                  </div>
                </div>
              </div>
            </button>

            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">
                أقسام العيادات
              </div>
              <div className="text-[11px] text-slate-400">
                يتم ضبط الأوقات والأسعار من لوحة تحكم المدير.
              </div>
            </div>

            {loading && (
              <div className="text-xs text-slate-400">جارٍ تحميل الأقسام…</div>
            )}

            {!loading && departments.length === 0 && !err && (
              <div className="text-xs text-slate-400">
                لا توجد أقسام مسجلة حاليًا في جدول{" "}
                <span className="font-semibold">departments</span>.
              </div>
            )}

            {!loading && departments.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {departments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/category?department=${encodeURIComponent(d.id)}&sub=`
                      )
                    }
                    className="group w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-start hover:border-pink-400/80 hover:bg-slate-900/90 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm sm:text-base font-extrabold text-slate-50">
                          {d.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {settings.deptDefaultHours}
                        </div>
                      </div>
                      <div className="text-right text-[11px] sm:text-xs text-emerald-300 font-semibold">
                        {deptPriceLabel}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {err && (
              <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-xs text-red-200 mt-2">
                {err}
              </div>
            )}
          </div>

          {/* يمين: معلومات عامة */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-4 py-4">
              <div className="text-sm font-semibold mb-2">معلومات العيادة</div>
              <div className="space-y-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500">أوقات الطوارئ:</span>{" "}
                  <span className="font-semibold text-emerald-200">
                    {settings.emergencyHours}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">
                    أوقات العيادات العادية:
                  </span>{" "}
                  <span className="font-semibold">
                    {settings.deptDefaultHours}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">سياسة الأسعار:</span>{" "}
                  <span className="font-semibold">
                    يتم ضبط الأسعار من لوحة تحكم المدير العام، بدون تعديل على
                    الجداول.
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-xs text-slate-400">
              <div className="font-semibold text-slate-100 mb-1">
                ملاحظة مهمة
              </div>
              <p>
                هذه الصفحة فقط لاختيار القسم. بعد اختيار القسم والتخصص من ملف
                المريض، سيتم فتح صفحة الأطباء والبث المباشر للتخصص المطلوب.
              </p>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-pink-500/50" />
      </div>
    </div>
  );
}

/* ====================== صفحة اختيار الطبيب + البث + الشات ====================== */

function DoctorSelectionPage({
  departmentId,
  subSpecialtyId,
}: {
  departmentId: string;
  subSpecialtyId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [deptName, setDeptName] = useState<string>("القسم");
  const [subName, setSubName] = useState<string>("التخصص");

  const [queueState, setQueueState] = useState<
    "idle" | "creating" | "done" | "error"
  >("idle");
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const [deptRes, specRes] = await Promise.all([
          supabase
            .from("departments")
            .select("id, name_ar, name_en")
            .eq("id", departmentId)
            .maybeSingle(),
          supabase
            .from("specialties")
            .select("id, name_ar, name_en, department_id")
            .eq("id", subSpecialtyId)
            .maybeSingle(),
        ]);

        if (!alive) return;

        if (deptRes.data) setDeptName(inferLabel(deptRes.data));
        if (specRes.data) setSubName(inferLabel(specRes.data));

        const { data: docRows, error: docErr } = await supabase
          .from("doctors")
          .select("profile_id, specialty_id, rank_id, is_approved")
          .eq("specialty_id", subSpecialtyId)
          .eq("is_approved", true);

        if (docErr) throw docErr;

        if (!docRows || docRows.length === 0) {
          setDoctors([]);
          setSelectedId(null);
          setLoading(false);
          return;
        }

        const profileIds = docRows.map((r) => r.profile_id);

        const [
          { data: profRows, error: profErr },
          { data: ranksRows },
          { data: specRows2 },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", profileIds),
          supabase.from("doctor_ranks").select("id, name_ar, name_en"),
          supabase.from("specialties").select("id, name_ar, name_en"),
        ]);

        if (profErr) throw profErr;

        const rankMap = new Map<
          number,
          { name_ar: string | null; name_en: string | null }
        >();
        (ranksRows || []).forEach((r: any) =>
          rankMap.set(r.id, {
            name_ar: r.name_ar ?? null,
            name_en: r.name_en ?? null,
          })
        );

        const specMap = new Map<
          number,
          { name_ar: string | null; name_en: string | null }
        >();
        (specRows2 || []).forEach((s: any) =>
          specMap.set(s.id, {
            name_ar: s.name_ar ?? null,
            name_en: s.name_en ?? null,
          })
        );

        const profMap = new Map<
          string,
          { full_name: string | null; username: string | null }
        >();
        (profRows || []).forEach((p: any) =>
          profMap.set(p.id, {
            full_name: p.full_name ?? null,
            username: p.username ?? null,
          })
        );

        const finalDoctors: DoctorRow[] = (docRows || []).map((d: any) => {
          const p = profMap.get(d.profile_id) || {
            full_name: null,
            username: null,
          };
          const r = rankMap.get(d.rank_id) || { name_ar: null, name_en: null };
          const s = specMap.get(d.specialty_id) || {
            name_ar: null,
            name_en: null,
          };

          return {
            doctor_id: String(d.profile_id),
            profile_id: String(d.profile_id),
            full_name:
              safeText(p.full_name) !== "—"
                ? safeText(p.full_name)
                : safeText(p.username),
            username: p.username,
            rank_name: safeText(r.name_ar) !== "—" ? safeText(r.name_ar) : null,
            specialty_name:
              safeText(s.name_ar) !== "—" ? safeText(s.name_ar) : null,
          };
        });

        if (!alive) return;
        setDoctors(finalDoctors);
        if (finalDoctors.length > 0) setSelectedId(finalDoctors[0].profile_id);
      } catch (e: any) {
        if (!alive) return;
        console.error(e);
        setErr(e?.message ?? "تعذر تحميل قائمة الأطباء.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [departmentId, subSpecialtyId]);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.profile_id === selectedId) || null,
    [doctors, selectedId]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleStartSession = useCallback(async () => {
    if (!selectedDoctor) {
      setQueueState("error");
      setQueueMessage("يجب اختيار طبيب أولاً قبل طلب الجلسة.");
      return;
    }

    try {
      setQueueState("creating");
      setQueueMessage(null);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setQueueState("error");
        setQueueMessage("يجب تسجيل الدخول بحساب المريض قبل طلب الجلسة.");
        return;
      }

      const patientId = authData.user.id;

      const { data: existing, error: existingErr } = await supabase
        .from("consultation_queue")
        .select("id, status")
        .eq("doctor_id", selectedDoctor.doctor_id)
        .eq("patient_id", patientId)
        .in("status", ["waiting", "called", "in_session"]);

      if (existingErr) {
        console.error(existingErr);
        setQueueState("error");
        setQueueMessage("حدث خطأ أثناء التحقق من الجلسات السابقة.");
        return;
      }

      if (existing && existing.length > 0) {
        const row = existing[0];
        setQueueId(row.id);
        setQueueState("done");
        setQueueMessage(
          "لديك بالفعل طلب جلسة قائم مع هذا الطبيب. انتظر حتى يقوم الطبيب بمناداتك من غرفة العيادة."
        );
        return;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("consultation_queue")
        .insert({
          doctor_id: selectedDoctor.doctor_id,
          patient_id: patientId,
          status: "waiting",
          requested_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error(insertErr);
        setQueueState("error");
        setQueueMessage("تعذر إنشاء طلب الجلسة. حاول مرة أخرى لاحقاً.");
        return;
      }

      if (inserted?.id) {
        setQueueId(inserted.id);
      }

      setQueueState("done");
      setQueueMessage(
        "تم إرسال طلب الجلسة بنجاح. ستظهر في قائمة الانتظار لدى الطبيب، وسيقوم بمناداتك من غرفة العيادة."
      );
    } catch (e: any) {
      console.error(e);
      setQueueState("error");
      setQueueMessage("حدث خطأ غير متوقع أثناء طلب الجلسة.");
    }
  }, [selectedDoctor]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 py-6 px-3">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* العنوان العلوي */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/patient/profile")}
            className="rounded-full px-4 py-2 text-xs sm:text-sm border border-slate-700 bg-slate-900/70 hover:bg-slate-800"
          >
            رجوع إلى مِلَفي الصحي
          </button>

          <div className="text-center flex-1">
            <div className="text-xs text-emerald-300 mb-1">
              غرفة الكشف المباشر
            </div>
            <div className="text-lg sm:text-2xl font-extrabold">
              اختر الطبيب المناسب لك
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 mt-1">
              القسم: <span className="font-semibold">{deptName}</span> — التخصص:{" "}
              <span className="font-semibold">{subName}</span>
            </div>
          </div>

          {/* شعار الموقع كزر يرجع للرئيسية */}
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="h-10 w-10 rounded-full bg-slate-900 border border-emerald-400/70 grid place-items-center text-xs font-extrabold">
              DR4X
            </div>
          </button>
        </div>

        {err && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
            {err}
          </div>
        )}

        {/* الوسط: بث + شات + قائمة الأطباء */}
        <div className="mt-2 flex flex-col gap-4 md:flex-row">
          {/* معلومات الطبيب */}
          <aside className="w-full md:w-60 lg:w-64 rounded-3xl border border-slate-800 bg-slate-900/85 p-4 space-y-3 order-2 md:order-1">
            <div className="text-sm font-bold mb-1">معلومات الطبيب المختار</div>

            {selectedDoctor ? (
              <div className="space-y-2 text-xs text-slate-200">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-800 grid place-items-center">
                    <UserCircle2 className="h-7 w-7 text-slate-200" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold">
                      {selectedDoctor.full_name}
                    </div>
                    {selectedDoctor.username && (
                      <div className="text-[11px] text-slate-400">
                        @{selectedDoctor.username}
                      </div>
                    )}
                  </div>
                </div>

                {selectedDoctor.rank_name && (
                  <div>
                    <span className="text-slate-400">الدرجة:</span>{" "}
                    <span className="font-semibold">
                      {selectedDoctor.rank_name}
                    </span>
                  </div>
                )}

                {selectedDoctor.specialty_name && (
                  <div>
                    <span className="text-slate-400">التخصص:</span>{" "}
                    <span className="font-semibold">
                      {selectedDoctor.specialty_name}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                لم يتم اختيار أي طبيب بعد. اختر طبيبًا من الشريط الجانبي الأيمن
                لتظهر بياناته هنا.
              </div>
            )}
          </aside>

          {/* شاشة البث + الشات */}
          <section className="flex-1 rounded-3xl border border-slate-800 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6 flex flex-col gap-4 order-1 md:order-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">
                  شاشة البث المباشر
                </div>
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm font-bold">
                    عندما يبدأ الطبيب الجلسة، سيتم عرض الفيديو والصوت هنا.
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
                <span>الاتصال محمي ومشفّر</span>
                <span>لا يتم حفظ الفيديو في الخادم</span>
              </div>
            </div>

            <div className="flex-1 rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top,_#10b98133,_transparent_55%),radial-gradient(circle_at_bottom,_#22d3ee33,_transparent_60%)] px-4 sm:px-6 py-6 flex items-center justify-center text-center">
              {selectedDoctor ? (
                <div className="space-y-3 max-w-md mx-auto">
                  <div className="text-sm text-slate-300">
                    سيتم بدء الجلسة مع الطبيب:
                  </div>
                  <div className="text-lg sm:text-2xl font-extrabold text-white">
                    {selectedDoctor.full_name}
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    {selectedDoctor.rank_name && (
                      <div>الدرجة العلمية: {selectedDoctor.rank_name}</div>
                    )}
                    {selectedDoctor.specialty_name && (
                      <div>التخصص الدقيق: {selectedDoctor.specialty_name}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <button
                      type="button"
                      className="rounded-full px-6 py-2 text-xs sm:text-sm font-bold bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                      onClick={handleStartSession}
                      disabled={queueState === "creating"}
                    >
                      {queueState === "creating"
                        ? "جاري إرسال الطلب..."
                        : "بدء الجلسة مع الطبيب"}
                    </button>
                  </div>
                  {queueMessage && (
                    <div className="text-[11px] text-slate-200 pt-1">
                      {queueMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 max-w-md mx-auto">
                  <div className="text-lg sm:text-xl font-extrabold text-white">
                    اختر طبيبًا من القائمة الجانبية لبدء التحضير للجلسة.
                  </div>
                  <div className="text-xs text-slate-300">
                    بعد اختيار الطبيب، ستظهر تفاصيله في الشريط الأيسر، ويمكنك
                    لاحقًا بدء البث المباشر من هنا.
                  </div>
                </div>
              )}
            </div>

            {/* صندوق الشات (مريض ↔ طبيب) */}
            <ConsultationChat
              queueId={queueId}
              role="patient"
              disabled={queueState !== "done"}
            />
          </section>

          {/* قائمة الأطباء */}
          <aside className="w-full md:w-64 lg:w-72 rounded-3xl border border-slate-800 bg-slate-900/85 p-4 space-y-3 order-3 md:order-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold">الأطباء المتاحون الآن</div>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                مباشر
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              اختر الطبيب بالضغط على الكرت، وسيتم عرض تفاصيله في الشريط الجانبي
              الآخر، مع تحضير شاشة البث في المنتصف.
            </p>

            {loading && (
              <div className="text-xs text-slate-400">جارٍ تحميل الأطباء…</div>
            )}

            {!loading && doctors.length === 0 && !err && (
              <div className="text-xs text-slate-400">
                لا يوجد أطباء متاحون حاليًا في هذا التخصص. جرّب لاحقًا أو اختر
                قسمًا آخر.
              </div>
            )}

            {!loading && doctors.length > 0 && (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {doctors.map((doc) => {
                  const active = doc.profile_id === selectedId;
                  return (
                    <button
                      key={doc.profile_id}
                      type="button"
                      onClick={() => handleSelect(doc.profile_id)}
                      className={[
                        "w-full text-right rounded-2xl border px-3 py-3 text-xs sm:text-sm transition flex items-center gap-3",
                        active
                          ? "border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
                          : "border-slate-800 bg-slate-900/80 hover:bg-slate-900",
                      ].join(" ")}
                    >
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-slate-800 grid place-items-center">
                          <UserCircle2 className="h-6 w-6 text-slate-300" />
                        </div>
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="font-extrabold text-slate-50 truncate">
                          {doc.full_name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {doc.rank_name && <span>{doc.rank_name}</span>}
                          {doc.rank_name && doc.specialty_name && " • "}
                          {doc.specialty_name && (
                            <span>{doc.specialty_name}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ====================== المكوّن الرئيسي ====================== */

export default function CategoryPage() {
  const searchParams = useSearchParams();
  const department = searchParams.get("department");
  const sub = searchParams.get("sub");

  if (!department || !sub) {
    return <CategoryLandingPage />;
  }

  return <DoctorSelectionPage departmentId={department} subSpecialtyId={sub} />;
}
