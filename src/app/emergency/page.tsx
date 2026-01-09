// src/app/emergency/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { getSystemSettingString } from "@/utils/systemSettings";

type DoctorRow = any; // لا نفترض أعمدة معيّنة في جدول الأطباء

type SelectedDoctor = {
  id: string;
  name: string;
  specialtyMain: string | null;
  specialtySub: string | null;
  bio: string | null;

  // ✅ نستخدم avatarUrl في الواجهة (قد يكون URL كامل أو path في الستوريج)
  avatarUrl: string | null;
};

const DOCTOR_AVATAR_BUCKET = "avatars";

function isHttpUrl(s: string) {
  const v = (s || "").trim().toLowerCase();
  return v.startsWith("http://") || v.startsWith("https://");
}

// ✅ إذا جاء avatarUrl كـ path (مثل uid/avatar.jpg) نحوله إلى Signed URL
async function resolveAvatarUrlMaybe(pathOrUrl: string | null): Promise<string | null> {
  const raw = (pathOrUrl || "").trim();
  if (!raw) return null;

  // URL جاهز
  if (isHttpUrl(raw)) return raw;

  // data: (نادر) لكن نخليه
  if (raw.startsWith("data:")) return raw;

  // نعتبره path داخل storage (avatars)
  try {
    const { data, error } = await supabase.storage
      .from(DOCTOR_AVATAR_BUCKET)
      .createSignedUrl(raw, 60 * 60);

    if (error) return null;

    const url = data?.signedUrl ?? "";
    return url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : null;
  } catch {
    return null;
  }
}

function buildDoctorFromRow(row: DoctorRow): SelectedDoctor {
  const id = String(row.id ?? "").trim() || "unknown";

  const name =
    (row.full_name ??
      row.display_name ??
      row.name ??
      row.username ??
      "دكتور") || "دكتور";

  const specialtyMain =
    row.specialty_main ??
    row.main_specialty ??
    row.specialty ??
    row.primary_specialty ??
    null;

  const specialtySub =
    row.specialty_sub ?? row.secondary_specialty ?? row.sub_specialty ?? null;

  const bio = row.bio ?? row.description ?? row.about ?? null;

  // ✅ نجمع أي مرجع محتمل للصورة (URL أو path)
  const avatarRef =
    row.avatar_url ??
    row.photo_url ??
    row.image_url ??
    row.avatar ??
    row.avatar_path ??
    null;

  return {
    id,
    name,
    specialtyMain,
    specialtySub,
    bio,
    avatarUrl: avatarRef ? String(avatarRef) : null,
  };
}

export default function EmergencyClinicPage() {
  const router = useRouter();

  const [siteName, setSiteName] = useState("DR4X");
  const [siteLogoUrl, setSiteLogoUrl] = useState<string>("/dr4x-logo.png");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<SelectedDoctor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // إعدادات اسم/شعار الموقع
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [n, logo] = await Promise.all([
          getSystemSettingString("site_name", "DR4X"),
          getSystemSettingString("site_logo_url", ""),
        ]);

        if (!alive) return;

        const finalName = (n || "DR4X").trim() || "DR4X";
        const finalLogo = (logo || "").trim();

        setSiteName(finalName);
        setSiteLogoUrl(finalLogo || "/dr4x-logo.png");
      } catch {
        if (!alive) return;
        setSiteName("DR4X");
        setSiteLogoUrl("/dr4x-logo.png");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // جلب الأطباء من جدول doctors (قراءة فقط)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data, error } = await supabase
          .from("doctors")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (!alive) return;

        // ✅ نبني الدكاترة ثم نحوّل avatarUrl إن كان path إلى Signed URL
        const mappedBase = (data ?? []).map(buildDoctorFromRow);

        const mapped = await Promise.all(
          mappedBase.map(async (d) => {
            const resolved = await resolveAvatarUrlMaybe(d.avatarUrl);
            return { ...d, avatarUrl: resolved ?? d.avatarUrl };
          })
        );

        if (!alive) return;

        setDoctors(mapped);

        if (mapped.length > 0 && !selectedId) {
          setSelectedId(mapped[0].id);
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(
          e?.message ??
            "تعذر تحميل قائمة أطباء الطوارئ (قراءة من جدول doctors فقط)."
        );
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDoctor: SelectedDoctor | null = useMemo(() => {
    if (!selectedId) return null;
    return doctors.find((d) => d.id === selectedId) ?? null;
  }, [doctors, selectedId]);

  function handleDoctorClick(d: SelectedDoctor) {
    setSelectedId(d.id);
  }

  function goHome() {
    router.push("/home");
  }

  function requestEmergencyConsult() {
    router.push("/patient/request-consultation");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 py-8 px-3 sm:px-6">
      <div className="max-w-5xl mx-auto rounded-[32px] border border-pink-500/60 bg-slate-950 shadow-[0_0_40px_rgba(236,72,153,0.5)]">
        {/* الهيدر العلوي */}
        <header className="flex items-center justify-between px-6 pt-5 pb-3">
          <button
            type="button"
            onClick={goHome}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            الرجوع للرئيسية
          </button>

          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteLogoUrl}
              alt={siteName}
              className="h-10 w-10 rounded-full border border-pink-500/70 bg-slate-900 object-cover cursor-pointer"
              onClick={goHome}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.src = "/dr4x-logo.png";
              }}
            />
            <div className="text-end leading-tight">
              <div className="text-[11px] text-emerald-300 tracking-wide">
                Emergency · Clinic
              </div>
              <div className="text-lg font-extrabold">{siteName}</div>
              <div className="text-xs text-slate-400">
                اختر الطبيب من القائمة بالأسفل واستعرض ملفه في النافذة الكبيرة.
              </div>
            </div>
          </div>
        </header>

        {/* منطقة البروفايل العلوية — نفس التصميم لكن صورة الدكتور مثبتة يمين */}
        <section className="px-6 pb-4">
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {/* الكرت الأسود (النبذة) على اليسار */}
            <div className="flex-1">
              <div className="rounded-3xl bg-black/90 border border-slate-800 px-6 py-6 min-h-[140px] flex items-center">
                <div className="text-sm leading-relaxed text-slate-50">
                  {selectedDoctor?.bio ? (
                    <span>{selectedDoctor.bio}</span>
                  ) : (
                    <span className="text-slate-400">
                      هنا تُعرض النبذة التي كتبها الطبيب عن نفسه
                      (bio/description من جدول الأطباء). إذا لم تظهر، تأكد أن
                      بيانات الطبيب محدثة في لوحة التحكم.
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                * بمجرد اختيار طبيب من القائمة بالأسفل، يتم تحديث هذه النافذة
                وصورة الطبيب على اليمين بدون تحديث للصفحة.
              </p>
            </div>

            {/* بطاقة صورة الطبيب — على اليمين في المتصفح العربي */}
            <div className="w-full md:w-64 md:ml-auto">
              <div className="rounded-3xl border border-slate-700 bg-slate-900/80 px-4 py-5 flex flex-col items-center gap-3">
                <div className="relative w-32 h-32 rounded-full overflow-hidden border border-pink-500/80 shadow-[0_0_30px_rgba(236,72,153,0.8)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      selectedDoctor?.avatarUrl && selectedDoctor.avatarUrl.trim()
                        ? selectedDoctor.avatarUrl
                        : siteLogoUrl
                    }
                    alt={selectedDoctor?.name ?? siteName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = siteLogoUrl;
                    }}
                  />
                </div>

                <div className="text-center space-y-1">
                  <div className="text-sm font-extrabold">
                    {selectedDoctor?.name ?? "اختر طبيباً من الأسفل"}
                  </div>
                  {selectedDoctor?.specialtyMain && (
                    <div className="text-xs text-emerald-300">
                      {selectedDoctor.specialtyMain}
                      {selectedDoctor.specialtySub
                        ? ` – ${selectedDoctor.specialtySub}`
                        : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ملاحظة نصية */}
        <section className="px-6 pb-4">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3 text-[11px] text-slate-300">
            عند الضغط على أي صورة دكتور من القائمة، يتم تكبيرها في النافذة
            الكبيرة بالأعلى ويتم عرض بياناته، ويمكنك الضغط على زر{" "}
            <span className="font-semibold text-emerald-300">
              استشارة مع دكتور
            </span>{" "}
            لبدء طلب استشارة طوارئ.
          </div>
        </section>

        {/* شبكة الأطباء (نفس ما كان) */}
        <section className="px-6 pb-6">
          <div className="mb-2 text-sm font-semibold text-slate-100">
            أطباء الطوارئ
          </div>

          {err && (
            <div className="mb-3 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-xs text-red-200">
              {err}
            </div>
          )}

          {loading && doctors.length === 0 ? (
            <div className="text-sm text-slate-300 py-4">
              جارٍ تحميل قائمة الأطباء…
            </div>
          ) : null}

          {!loading && doctors.length === 0 ? (
            <div className="text-sm text-slate-300 py-4">
              لا يوجد أطباء طوارئ متاحون حالياً.
            </div>
          ) : null}

          {doctors.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {doctors.map((d) => {
                const isActive = d.id === selectedId;
                const avatar =
                  d.avatarUrl && d.avatarUrl.trim() ? d.avatarUrl : siteLogoUrl;

                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleDoctorClick(d)}
                    className={[
                      "group relative overflow-hidden rounded-3xl border px-0 pb-0 pt-0 text-start",
                      "bg-slate-950/80 border-slate-800",
                      "shadow-[0_0_18px_rgba(15,23,42,0.9)]",
                      isActive
                        ? "ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-slate-950"
                        : "",
                    ].join(" ")}
                  >
                    <div className="h-40 w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatar}
                        alt={d.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = siteLogoUrl;
                        }}
                      />
                    </div>

                    <div className="bg-black text-slate-50 px-3 py-2 text-center text-xs leading-relaxed">
                      <div className="font-extrabold text-[13px]">{d.name}</div>
                      {d.specialtyMain && (
                        <div className="text-[11px] text-emerald-300">
                          {d.specialtyMain}
                          {d.specialtySub ? ` – ${d.specialtySub}` : ""}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* زر الاستشارة */}
        <section className="px-6 pb-6">
          <button
            type="button"
            onClick={requestEmergencyConsult}
            className="w-full rounded-full bg-emerald-500 py-3 text-sm font-extrabold text-slate-900 hover:bg-emerald-400"
          >
            استشارة مع دكتور
          </button>
        </section>
      </div>
    </div>
  );
}
