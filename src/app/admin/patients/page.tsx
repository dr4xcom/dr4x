// src/app/admin/patients/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type PatientRow = {
  profile_id: string;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
  is_doctor?: boolean | null;
  created_at?: string | null;
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

export default function AdminPatientsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileRow>>({});

  const [q, setQ] = useState("");

  // pagination
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 60;

  // ✅ هل يوجد المزيد؟
  const [hasMore, setHasMore] = useState(true);

  // ✅ لمعرفة مصدر البيانات (patients أو profiles fallback)
  const [source, setSource] = useState<"patients" | "profiles">("patients");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // ✅ 1) محاولة جلب من جدول patients
        const resPatients = await supabase
          .from("patients")
          .select("profile_id,created_at")
          .order("created_at", { ascending: false })
          .range(from, to);

        // لو نجحت patients
        if (!resPatients.error) {
          const list = (resPatients.data ?? []) as PatientRow[];

          // ✅ منع التكرار
          if (!alive) return;
          setPatients((prev) => {
            const map = new Map<string, PatientRow>();
            prev.forEach((x) => map.set(x.profile_id, x));
            list.forEach((x) => map.set(x.profile_id, x));
            return Array.from(map.values());
          });

          // ✅ تحديد هل يوجد المزيد
          if (!alive) return;
          setHasMore(list.length >= PAGE_SIZE);
          setSource("patients");

          // جلب profiles للمرضى الظاهرين
          const ids = Array.from(new Set(list.map((p) => p.profile_id).filter(Boolean)));
          if (ids.length) {
            const { data: profs, error: profErr } = await supabase
              .from("profiles")
              .select("id,username,full_name,email,whatsapp_number,is_doctor,created_at")
              .in("id", ids);

            if (profErr) throw profErr;

            const map: Record<string, ProfileRow> = {};
            (profs ?? []).forEach((p: any) => {
              if (p?.id) map[p.id] = p as ProfileRow;
            });

            if (!alive) return;
            setProfilesMap((prev) => ({ ...prev, ...map }));
          }

          if (!alive) return;
          setLoading(false);
          return;
        }

        // ✅ 2) Fallback: جلب المرضى من profiles (is_doctor = false)
        const resProfiles = await supabase
          .from("profiles")
          .select("id,username,full_name,email,whatsapp_number,is_doctor,created_at")
          .eq("is_doctor", false)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (resProfiles.error) throw resProfiles.error;

        const profs = (resProfiles.data ?? []) as ProfileRow[];
        const list: PatientRow[] = profs.map((p) => ({
          profile_id: p.id,
          created_at: p.created_at ?? null,
        }));

        // خزّن البروفايلات مباشرة
        const map: Record<string, ProfileRow> = {};
        profs.forEach((p) => {
          if (p?.id) map[p.id] = p;
        });

        if (!alive) return;

        setProfilesMap((prev) => ({ ...prev, ...map }));

        // ✅ منع التكرار
        setPatients((prev) => {
          const m = new Map<string, PatientRow>();
          prev.forEach((x) => m.set(x.profile_id, x));
          list.forEach((x) => m.set(x.profile_id, x));
          return Array.from(m.values());
        });

        setHasMore(list.length >= PAGE_SIZE);
        setSource("profiles");
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(
          e?.message ??
            "حدث خطأ أثناء جلب المرضى. (قد تكون صلاحيات RLS لا تسمح بالعرض للأدمن)."
        );
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [page]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return patients;

    return patients.filter((p) => {
      const prof = profilesMap[p.profile_id];
      const full = (prof?.full_name ?? "").toLowerCase();
      const user = (prof?.username ?? "").toLowerCase();
      const email = (prof?.email ?? "").toLowerCase();
      const wa = (prof?.whatsapp_number ?? "").toLowerCase();
      const id = (p.profile_id ?? "").toLowerCase();
      return full.includes(needle) || user.includes(needle) || email.includes(needle) || wa.includes(needle) || id.includes(needle);
    });
  }, [q, patients, profilesMap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Admin</div>
          <h2 className="text-lg font-extrabold">المرضى</h2>
          <div className="text-sm text-slate-300">
            عرض المرضى وبياناتهم الأساسية + بحث (بدون أي تعديل DB/RLS).
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث (اسم/يوزر/إيميل/واتساب/ID)…"
          className="w-full sm:w-80 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
        />
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold">قائمة المرضى</div>
          <div className="text-xs text-slate-400">
            المعروض: {filtered.length} {loading ? "• جارٍ التحميل…" : ""}{" "}
            <span className="text-slate-600">• المصدر: {source === "patients" ? "patients" : "profiles"}</span>
          </div>
        </div>

        {loading && patients.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">جارٍ جلب المرضى…</div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">لا يوجد مرضى مطابقون.</div>
        ) : null}

        <div className="divide-y divide-slate-800">
          {filtered.map((p) => {
            const prof = profilesMap[p.profile_id];

            return (
              <div key={p.profile_id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-extrabold truncate">
                        {prof?.full_name?.trim() ? prof.full_name : "بدون اسم"}
                      </div>

                      <span className="text-xs text-slate-500 truncate">ID: {p.profile_id}</span>

                      {prof?.is_doctor === true ? (
                        <span className="text-xs font-bold rounded-full px-2 py-1 border border-amber-900/50 bg-amber-950/40 text-amber-200">
                          ملاحظة: is_doctor=true
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-500">Username:</span>{" "}
                        <span className="font-semibold">{safeText(prof?.username)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Email:</span>{" "}
                        <span className="font-semibold">{safeText(prof?.email)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">WhatsApp:</span>{" "}
                        <span className="font-semibold">{safeText(prof?.whatsapp_number)}</span>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <span className="text-slate-500">created_at:</span>{" "}
                        <span className="font-semibold">{safeText(p.created_at ?? prof?.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                    <button
                      type="button"
                      disabled
                      className="rounded-xl border border-slate-900 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-600 cursor-not-allowed"
                      title="لاحقًا: فتح سجل المريض/الملف الطبي (بدون تعديل DB الآن)"
                    >
                      ملف المريض (قريبًا)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            ملاحظة: هذه الصفحة تحاول أولًا جدول patients، ولو فشل (RLS/اختلاف تنفيذ) تستخدم profiles (is_doctor=false) كحل بديل آمن بدون أي تغييرات.
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || !hasMore}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-semibold transition",
              loading || !hasMore
                ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                : "border-slate-800 bg-slate-900/40 text-slate-200 hover:bg-slate-900",
            ].join(" ")}
            title={!hasMore ? "لا يوجد المزيد" : "تحميل المزيد"}
          >
            {hasMore ? "تحميل المزيد" : "انتهت النتائج"}
          </button>
        </div>
      </div>
    </div>
  );
}
