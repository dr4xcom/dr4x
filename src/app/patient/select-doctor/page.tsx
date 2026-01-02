// src/app/patient/choose-doctor/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

/* ======================= Types ======================= */

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
  avatar_url: string | null;
  bio?: string | null;
};

type SpecialtyRow = {
  id: number;
  department_id: number | null;
  name_ar: string | null;
};

type DepartmentRow = {
  id: number;
  name_ar: string | null;
};

type RankRow = {
  id: number;
  name_ar: string | null;
};

type DoctorCard = {
  profileId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  specialtyName: string;
  departmentName: string;
  rankName: string;
  bio: string | null;
};

function safeText(v: any, fallback: string = "—") {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return fallback;
}

/* ======================= Component ======================= */

export default function PatientChooseDoctorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [meId, setMeId] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [recentDoctors, setRecentDoctors] = useState<DoctorCard[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  const deptIdParam = searchParams.get("dept"); // اختياري
  const specialtyIdParam = searchParams.get("specialty"); // اختياري

  const deptFilterLabel = useMemo(() => {
    if (specialtyIdParam) return "تخصص معيّن";
    if (deptIdParam) return "قسم معيّن";
    return "كل الأقسام";
  }, [deptIdParam, specialtyIdParam]);

  /* -------- تحميل المستخدم + الأطباء -------- */

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // 1) التحقق من تسجيل الدخول
        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;

        const uid = uRes?.user?.id ?? null;
        if (!uid) {
          router.push("/auth/login");
          return;
        }
        if (!alive) return;
        setMeId(uid);

        // 2) تجهيز فلتر التخصص من القسم
        let specialtyIdsForDept: number[] | null = null;

        if (specialtyIdParam) {
          const sid = Number(specialtyIdParam);
          if (Number.isFinite(sid)) {
            specialtyIdsForDept = [sid];
          }
        } else if (deptIdParam) {
          const did = Number(deptIdParam);
          if (Number.isFinite(did)) {
            const { data: specRows, error: specErr } = await supabase
              .from("specialties")
              .select("id")
              .eq("department_id", did);

            if (specErr) throw specErr;
            specialtyIdsForDept =
              (specRows || [])
                .map((r: any) => Number(r.id))
                .filter((n) => Number.isFinite(n)) ?? [];
          }
        }

        // 3) جلب الأطباء المعتمدين
        let doctorsQuery = supabase
          .from("doctors")
          .select("*")
          .eq("is_approved", true);

        if (specialtyIdsForDept && specialtyIdsForDept.length > 0) {
          doctorsQuery = doctorsQuery.in("specialty_id", specialtyIdsForDept);
        }

        const { data: doctorRows, error: doctorErr } =
          await doctorsQuery;

        if (doctorErr) throw doctorErr;

        const doctorList: DoctorRow[] = (doctorRows || []) as any[];

        if (!doctorList.length) {
          if (!alive) return;
          setDoctors([]);
          setRecentDoctors([]);
          setSelectedDoctorId(null);
          setLoading(false);
          return;
        }

        const doctorProfileIds = doctorList.map((d) => d.profile_id);

        // 4) جلب ملفات الأطباء (الاسم + الصورة + النبذة)
        const [{ data: profRows, error: profErr }, specialtiesRes, ranksRes, deptsRes] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id, full_name, username, avatar_url, bio")
              .in("id", doctorProfileIds),
            supabase.from("specialties").select("id, department_id, name_ar"),
            supabase.from("doctor_ranks").select("id, name_ar"),
            supabase.from("departments").select("id, name_ar"),
          ]);

        if (profErr) throw profErr;
        const specRows = (specialtiesRes.data || []) as any[];
        const rankRows = (ranksRes.data || []) as any[];
        const deptRows = (deptsRes.data || []) as any[];

        const profileById = new Map<string, ProfileRow>();
        (profRows || []).forEach((p: any) => {
          profileById.set(p.id, p as ProfileRow);
        });

        const specById = new Map<number, SpecialtyRow>();
        specRows.forEach((s: any) => {
          specById.set(Number(s.id), s as SpecialtyRow);
        });

        const deptById = new Map<number, DepartmentRow>();
        deptRows.forEach((d: any) => {
          deptById.set(Number(d.id), d as DepartmentRow);
        });

        const rankById = new Map<number, RankRow>();
        rankRows.forEach((r: any) => {
          rankById.set(Number(r.id), r as RankRow);
        });

        // 5) بناء كروت الأطباء
        const cards: DoctorCard[] = doctorList.map((d) => {
          const prof = profileById.get(d.profile_id);
          const spec =
            d.specialty_id != null
              ? specById.get(Number(d.specialty_id))
              : undefined;
          const dept =
            spec && spec.department_id != null
              ? deptById.get(Number(spec.department_id))
              : undefined;
          const rank =
            d.rank_id != null
              ? rankById.get(Number(d.rank_id))
              : undefined;

          const name =
            safeText(prof?.full_name) !== "—"
              ? safeText(prof?.full_name)
              : safeText(prof?.username, "طبيب");

          return {
            profileId: d.profile_id,
            name,
            username: prof?.username ?? null,
            avatarUrl: prof?.avatar_url ?? null,
            specialtyName: safeText(spec?.name_ar, "تخصص عام"),
            departmentName: safeText(dept?.name_ar, "قسم طبي"),
            rankName: safeText(rank?.name_ar, "طبيب"),
            bio: prof?.bio ?? null,
          };
        });

        // 6) آخر 3 أطباء زارهم المريض من جدول consultations
        const { data: consRows, error: consErr } = await supabase
          .from("consultations")
          .select("doctor_id, created_at")
          .eq("patient_id", uid)
          .order("created_at", { ascending: false })
          .limit(30);

        if (consErr) {
          // لو فيه خطأ هنا ما نوقف الصفحة كلها
          console.warn("consultations error", consErr);
        }

        const recentIds: string[] = [];
        (consRows || []).forEach((row: any) => {
          const did = row.doctor_id as string | null;
          if (did && !recentIds.includes(did)) {
            recentIds.push(did);
          }
        });

        const recent = cards.filter((c) => recentIds.includes(c.profileId)).slice(0, 3);

        if (!alive) return;

        setDoctors(cards);
        setRecentDoctors(recent);
        if (!selectedDoctorId && cards.length > 0) {
          setSelectedDoctorId(cards[0].profileId);
        }
        setLoading(false);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message ?? "تعذر تحميل قائمة الأطباء.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, deptIdParam, specialtyIdParam, selectedDoctorId]);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.profileId === selectedDoctorId) || null,
    [doctors, selectedDoctorId]
  );

  /* ======================= UI ======================= */

  if (loading) {
    return (
      <div className="relative min-h-screen bg-slate-900 text-white">
        <div className="pointer-events-none absolute inset-0 bg-black/50" />
        <div className="relative flex items-center justify-center min-h-screen">
          <div className="rounded-3xl border border-white/10 bg-black/40 px-6 py-4 text-sm">
            جارٍ تجهيز غرفة الأطباء…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-900 text-white">
      {/* سواد 50% فوق الخلفية */}
      <div className="pointer-events-none absolute inset-0 bg-black/50" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* أعلى الصفحة */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="text-xs text-emerald-300 font-semibold">
              خطوة 2 · اختيار الطبيب
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold mt-1">
              اختر الطبيب المناسب لحالتك
            </h1>
            <div className="text-[11px] sm:text-xs text-white/65 mt-1">
              الفلتر الحالي:{" "}
              <span className="font-semibold text-emerald-200">
                {deptFilterLabel}
              </span>
              {" · "}
              يمكنك الرجوع لتغيير القسم في أي وقت.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/patient/profile")}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs sm:text-sm hover:bg-white/10"
            >
              الرجوع للملف الصحي
            </button>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs sm:text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              الرئيسية
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-2xl border border-red-500/40 bg-red-900/30 px-4 py-3 text-xs text-red-100">
            {err}
          </div>
        )}

        {doctors.length === 0 && !err && (
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/80">
            لا توجد أطباء معتمدون حاليًا في هذا القسم. يمكنك تجربة قسم آخر أو
            العودة لاحقًا.
          </div>
        )}

        {doctors.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[1.4fr,1.1fr]">
            {/* ===== وسط الصفحة: شاشة البث + الأطباء أسفلها ===== */}
            <div className="space-y-3">
              {/* شاشة البث (placeholder) */}
              <div className="relative rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-950 to-black overflow-hidden min-h-[260px] sm:min-h-[320px] flex items-center justify-center">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_60%),_radial-gradient(circle_at_bottom,_rgba(239,68,68,0.12),_transparent_55%)]" />

                <div className="relative flex flex-col items-center gap-2 text-center px-4">
                  <div className="text-[11px] sm:text-xs text-emerald-300 uppercase tracking-[0.2em]">
                    Live Clinic · Beta
                  </div>
                  <div className="text-lg sm:text-2xl font-extrabold">
                    سيتم فتح غرفة الفيديو بعد اختيار الطبيب
                  </div>
                  <div className="text-[11px] sm:text-xs text-white/70 max-w-md mt-1">
                    عند الضغط على الزر الأحمر{" "}
                    <span className="font-semibold text-rose-300">
                      "ابدأ المقابلة"
                    </span>{" "}
                    سيتم نقلك إلى صفحة غرفة الكشف المباشر لهذا الطبيب.
                  </div>

                  {selectedDoctor && (
                    <button
                      type="button"
                      onClick={() => {
                        // لا نلمس قواعد البيانات هنا، فقط انتقال مبدئي.
                        router.push(
                          `/clinic/room?doctor_id=${encodeURIComponent(
                            selectedDoctor.profileId
                          )}`
                        );
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-rose-500/40 hover:bg-rose-500"
                    >
                      بدء المقابلة مع د. {selectedDoctor.name}
                    </button>
                  )}
                </div>
              </div>

              {/* شريط الأطباء بأسفل شاشة البث */}
              <div className="rounded-3xl border border-white/10 bg-black/40 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    الأطباء المتاحون في هذا القسم
                  </div>
                  <div className="text-[11px] text-white/50">
                    اضغط على صورة الطبيب لاختياره · اضغط على الاسم لعرض
                    التفاصيل.
                  </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1">
                  {doctors.map((doc) => {
                    const isSelected = doc.profileId === selectedDoctorId;
                    return (
                      <div
                        key={doc.profileId}
                        className={[
                          "flex-shrink-0 rounded-2xl border px-3 py-2 min-w-[180px] max-w-[210px] cursor-pointer transition",
                          isSelected
                            ? "border-emerald-400 bg-emerald-500/10"
                            : "border-white/10 bg-slate-900/60 hover:border-emerald-300/70",
                        ].join(" ")}
                        onClick={() => setSelectedDoctorId(doc.profileId)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-9 w-9 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-xs font-bold">
                            {doc.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={doc.avatarUrl}
                                alt={doc.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              doc.name.slice(0, 2)
                            )}
                          </div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-emerald-200 hover:text-emerald-100 text-right"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDoctorId(doc.profileId);
                            }}
                          >
                            د. {doc.name}
                          </button>
                        </div>
                        <div className="text-[11px] text-white/70">
                          {doc.specialtyName}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          {doc.rankName} · {doc.departmentName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ===== يمين الصفحة: تفاصيل الطبيب + آخر 3 أطباء ===== */}
            <div className="space-y-3">
              {/* تفاصيل الطبيب المختار */}
              <div className="rounded-3xl border border-white/10 bg-black/50 px-4 py-4">
                <div className="text-sm font-semibold mb-2">
                  معلومات الطبيب المختار
                </div>

                {selectedDoctor ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-sm font-bold">
                        {selectedDoctor.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedDoctor.avatarUrl}
                            alt={selectedDoctor.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          selectedDoctor.name.slice(0, 2)
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-extrabold">
                          د. {selectedDoctor.name}
                        </div>
                        <div className="text-[11px] text-white/70">
                          {selectedDoctor.rankName} ·{" "}
                          {selectedDoctor.specialtyName}
                        </div>
                        <div className="text-[11px] text-white/50">
                          القسم: {selectedDoctor.departmentName}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-white/70 border-t border-white/10 pt-3 mt-2">
                      {selectedDoctor.bio
                        ? selectedDoctor.bio
                        : "لا توجد نبذة مكتوبة للطبيب حتى الآن. يمكن إضافتها من لوحة تحكم الطبيب لاحقًا."}
                    </div>

                    <div className="text-[10px] text-white/40 mt-1">
                      سيتم ربط هذه البيانات مع غرفة الكشف المباشر (الملفات
                      الطبية · العلامات الحيوية · الشكوى الحالية) في الخطوة
                      القادمة بدون إضافة جداول جديدة.
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-white/60">
                    اختر طبيبًا من القائمة في الأسفل لعرض تفاصيله هنا.
                  </div>
                )}
              </div>

              {/* آخر ثلاثة أطباء تمت زيارتهم */}
              <div className="rounded-3xl border border-white/10 bg-black/40 px-4 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">
                    الأطباء الذين زرتهم سابقًا
                  </div>
                  <div className="text-[10px] text-white/45">
                    يتم حسابها من جدول{" "}
                    <span className="font-semibold">consultations</span>{" "}
                    فقط (قراءة بدون أي تعديل).
                  </div>
                </div>

                {recentDoctors.length === 0 && (
                  <div className="text-[11px] text-white/60">
                    لم تقُم بأي زيارة سابقة لأطباء بعد. عند أول مقابلة سيتم
                    عرض آخر ثلاثة أطباء هنا.
                  </div>
                )}

                {recentDoctors.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {recentDoctors.map((doc) => (
                      <button
                        key={doc.profileId}
                        type="button"
                        onClick={() => setSelectedDoctorId(doc.profileId)}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-right hover:border-emerald-300/70 transition"
                      >
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-[11px] font-bold">
                          {doc.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={doc.avatarUrl}
                              alt={doc.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            doc.name.slice(0, 2)
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-semibold">
                            د. {doc.name}
                          </div>
                          <div className="text-[10px] text-white/60">
                            {doc.specialtyName} · {doc.rankName}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
