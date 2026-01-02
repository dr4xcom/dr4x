// src/app/admin/doctors/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type DoctorRow = {
  profile_id: string;
  licence_path: string | null;
  specialty_id: number | null;
  rank_id: number | null;
  is_approved: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  whatsapp_number: string | null;
};

type Specialty = {
  id: number;
  name_ar: string | null;
  name_en: string | null;
};

type Rank = {
  id: number;
  name_ar: string | null;
  name_en: string | null;
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

function isProbablyPdfPath(p: string) {
  const x = p.toLowerCase();
  return x.endsWith(".pdf") || x.includes(".pdf");
}

export default function AdminDoctorsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [specialties, setSpecialties] = useState<Record<number, Specialty>>({});
  const [ranks, setRanks] = useState<Record<number, Rank>>({});

  const [q, setQ] = useState("");
  const [approvedFilter, setApprovedFilter] = useState<"all" | "approved" | "pending">("all");

  // ✅ Signed URL cache
  const [licenseUrls, setLicenseUrls] = useState<Record<string, string>>({});
  const [licenseLoadingId, setLicenseLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const docRes = await supabase
          .from("doctors")
          .select("profile_id,licence_path,specialty_id,rank_id,is_approved")
          .order("profile_id", { ascending: false });

        if (docRes.error) throw docRes.error;
        const docs = (docRes.data ?? []) as DoctorRow[];

        const ids = docs.map((d) => d.profile_id);
        const profRes = await supabase
          .from("profiles")
          .select("id,full_name,username,email,whatsapp_number")
          .in("id", ids);

        if (profRes.error) throw profRes.error;

        const specRes = await supabase.from("specialties").select("id,name_ar,name_en");
        if (specRes.error) throw specRes.error;

        const rankRes = await supabase.from("doctor_ranks").select("id,name_ar,name_en");
        if (rankRes.error) throw rankRes.error;

        if (!alive) return;

        setDoctors(docs);

        const pMap: Record<string, ProfileRow> = {};
        (profRes.data ?? []).forEach((p: any) => {
          if (p?.id) pMap[p.id] = p as ProfileRow;
        });
        setProfiles(pMap);

        const sMap: Record<number, Specialty> = {};
        (specRes.data ?? []).forEach((s: any) => {
          if (typeof s?.id === "number") sMap[s.id] = s as Specialty;
        });
        setSpecialties(sMap);

        const rMap: Record<number, Rank> = {};
        (rankRes.data ?? []).forEach((r: any) => {
          if (typeof r?.id === "number") rMap[r.id] = r as Rank;
        });
        setRanks(rMap);

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر جلب بيانات الأطباء.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return doctors.filter((d) => {
      if (approvedFilter === "approved" && !d.is_approved) return false;
      if (approvedFilter === "pending" && d.is_approved) return false;

      if (!needle) return true;

      const p = profiles[d.profile_id];
      return (
        String(d.profile_id).toLowerCase().includes(needle) ||
        (p?.full_name ?? "").toLowerCase().includes(needle) ||
        (p?.username ?? "").toLowerCase().includes(needle) ||
        (p?.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [doctors, profiles, q, approvedFilter]);

  async function setApproval(profileId: string, next: boolean) {
    try {
      setErr(null);
      setSavingId(profileId);

      const { error } = await supabase.from("doctors").update({ is_approved: next }).eq("profile_id", profileId);
      if (error) throw error;

      setDoctors((prev) => prev.map((d) => (d.profile_id === profileId ? { ...d, is_approved: next } : d)));
    } catch (e: any) {
      setErr(e?.message ?? "فشل تحديث حالة الاعتماد.");
    } finally {
      setSavingId(null);
    }
  }

  async function getOrCreateSignedUrl(profileId: string, licencePath: string) {
    const cached = licenseUrls[profileId];
    if (cached) return cached;

    setLicenseLoadingId(profileId);

    const { data, error } = await supabase.storage
      .from("doctor_licenses")
      .createSignedUrl(licencePath, 60 * 5);

    if (error) throw error;

    const url = data?.signedUrl;
    if (!url) throw new Error("تعذر توليد رابط الملف.");

    setLicenseUrls((prev) => ({ ...prev, [profileId]: url }));
    return url;
  }

  // ✅ عرض PDF (تبويب جديد)
  async function openLicensePdf(profileId: string, licencePath: string | null) {
    try {
      setErr(null);

      if (!licencePath || !licencePath.trim()) {
        setErr("لا يوجد مسار ترخيص لهذا الطبيب.");
        return;
      }

      const url = await getOrCreateSignedUrl(profileId, licencePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message ?? "فشل فتح ملف الترخيص.");
    } finally {
      setLicenseLoadingId(null);
    }
  }

  // ✅ طباعة PDF: نفتح تبويب جديد ثم نستدعي print
  async function printLicensePdf(profileId: string, licencePath: string | null) {
    try {
      setErr(null);

      if (!licencePath || !licencePath.trim()) {
        setErr("لا يوجد مسار ترخيص لهذا الطبيب.");
        return;
      }

      const url = await getOrCreateSignedUrl(profileId, licencePath);

      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        setErr("المتصفح منع فتح نافذة جديدة. فعّل Pop-ups ثم جرّب.");
        return;
      }

      // انتظار تحميل التبويب ثم طباعة
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        try {
          // ننتظر حتى تصبح الصفحة جاهزة (لا يعمل دائمًا مع كل عارض PDF، لكن غالبًا ينفع)
          if (w.document?.readyState === "complete") {
            window.clearInterval(timer);
            w.focus();
            w.print();
          }

          // حماية: بعد 8 ثواني نوقف الانتظار ونترك المستخدم يطبع يدويًا
          if (Date.now() - startedAt > 8000) {
            window.clearInterval(timer);
            w.focus();
            // ما نغصبها.. يكفي نفتح الملف ويطبع يدويًا من العارض
          }
        } catch {
          // بعض المتصفحات تمنع الوصول لـ document بسبب عارض PDF
          // نكتفي بفتح الملف، والطباعة تكون يدويًا من زر الطباعة في العارض
          window.clearInterval(timer);
          w.focus();
        }
      }, 250);
    } catch (e: any) {
      setErr(e?.message ?? "فشل طباعة ملف الترخيص.");
    } finally {
      setLicenseLoadingId(null);
    }
  }

  // ✅ تحميل PDF (أفضل للطباعة اليدوية أيضًا)
  async function downloadLicensePdf(profileId: string, licencePath: string | null) {
    try {
      setErr(null);

      if (!licencePath || !licencePath.trim()) {
        setErr("لا يوجد مسار ترخيص لهذا الطبيب.");
        return;
      }

      const url = await getOrCreateSignedUrl(profileId, licencePath);

      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      // اسم مقترح للملف
      a.download = `license_${profileId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      setErr(e?.message ?? "فشل تحميل ملف الترخيص.");
    } finally {
      setLicenseLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Admin</div>
          <h2 className="text-lg font-extrabold">الأطباء</h2>
          <div className="text-sm text-slate-300">
            عرض الأطباء + اعتماد/رفض + عرض/طباعة/تحميل ترخيص PDF (Signed URL).
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={approvedFilter}
            onChange={(e) => setApprovedFilter(e.target.value as any)}
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            <option value="all">الكل</option>
            <option value="pending">بانتظار الاعتماد</option>
            <option value="approved">معتمد</option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث (اسم/يوزر/إيميل/ID)…"
            className="w-full sm:w-80 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
          />
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold">قائمة الأطباء</div>
          <div className="text-xs text-slate-400">{loading ? "جارٍ التحميل…" : `العدد: ${filtered.length}`}</div>
        </div>

        {loading && doctors.length === 0 ? <div className="p-4 text-sm text-slate-300">جارٍ جلب الأطباء…</div> : null}
        {!loading && filtered.length === 0 ? <div className="p-4 text-sm text-slate-300">لا توجد نتائج.</div> : null}

        <div className="divide-y divide-slate-800">
          {filtered.map((d) => {
            const p = profiles[d.profile_id];
            const spec = d.specialty_id ? specialties[d.specialty_id] : null;
            const rank = d.rank_id ? ranks[d.rank_id] : null;

            const hasPdf = !!(d.licence_path && isProbablyPdfPath(d.licence_path));
            const busy = licenseLoadingId === d.profile_id;

            return (
              <div key={d.profile_id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-extrabold truncate">{p?.full_name?.trim() || "بدون اسم"}</div>

                      <span
                        className={[
                          "text-xs font-bold rounded-full px-2 py-1 border",
                          d.is_approved
                            ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-200"
                            : "border-amber-900/60 bg-amber-950/40 text-amber-200",
                        ].join(" ")}
                      >
                        {d.is_approved ? "معتمد" : "بانتظار الاعتماد"}
                      </span>

                      <span className="text-xs text-slate-500 truncate">ID: {d.profile_id}</span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-500">Username:</span>{" "}
                        <span className="font-semibold">{safeText(p?.username)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Email:</span>{" "}
                        <span className="font-semibold">{safeText(p?.email)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">WhatsApp:</span>{" "}
                        <span className="font-semibold">{safeText(p?.whatsapp_number)}</span>
                      </div>

                      <div>
                        <span className="text-slate-500">التخصص:</span>{" "}
                        <span className="font-semibold">{spec ? spec.name_ar || spec.name_en || `#${spec.id}` : "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">الدرجة:</span>{" "}
                        <span className="font-semibold">{rank ? rank.name_ar || rank.name_en || `#${rank.id}` : "—"}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500">الترخيص (PDF):</span>
                        <span className="font-semibold break-all">{safeText(d.licence_path)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                    {!d.is_approved ? (
                      <button
                        type="button"
                        onClick={() => setApproval(d.profile_id, true)}
                        disabled={savingId === d.profile_id}
                        className={[
                          "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                          savingId === d.profile_id
                            ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                            : "border-emerald-900/60 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-950/60",
                        ].join(" ")}
                      >
                        اعتماد
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setApproval(d.profile_id, false)}
                        disabled={savingId === d.profile_id}
                        className={[
                          "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                          savingId === d.profile_id
                            ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                            : "border-amber-900/60 bg-amber-950/40 text-amber-200 hover:bg-amber-950/60",
                        ].join(" ")}
                      >
                        إلغاء الاعتماد
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openLicensePdf(d.profile_id, d.licence_path)}
                      disabled={!hasPdf || busy}
                      className={[
                        "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                        !hasPdf || busy
                          ? "border-slate-800 bg-slate-950/30 text-slate-500 cursor-not-allowed"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900/60",
                      ].join(" ")}
                      title={!hasPdf ? "لا يوجد ملف PDF محفوظ" : "فتح ملف الترخيص"}
                    >
                      {busy ? "…" : "عرض PDF"}
                    </button>

                    <button
                      type="button"
                      onClick={() => printLicensePdf(d.profile_id, d.licence_path)}
                      disabled={!hasPdf || busy}
                      className={[
                        "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                        !hasPdf || busy
                          ? "border-slate-800 bg-slate-950/30 text-slate-500 cursor-not-allowed"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900/60",
                      ].join(" ")}
                      title={!hasPdf ? "لا يوجد ملف PDF محفوظ" : "فتح الملف ومحاولة الطباعة"}
                    >
                      {busy ? "…" : "طباعة PDF"}
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadLicensePdf(d.profile_id, d.licence_path)}
                      disabled={!hasPdf || busy}
                      className={[
                        "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                        !hasPdf || busy
                          ? "border-slate-800 bg-slate-950/30 text-slate-500 cursor-not-allowed"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900/60",
                      ].join(" ")}
                      title={!hasPdf ? "لا يوجد ملف PDF محفوظ" : "تحميل ملف الترخيص"}
                    >
                      {busy ? "…" : "تحميل PDF"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
          ملاحظة: الملفات محفوظة دائمًا في Storage. Signed URL مجرد رابط مؤقت للعرض/الطباعة بأمان، وإذا انتهى تضغط زر مرة ثانية ويطلع رابط جديد.
        </div>
      </div>
    </div>
  );
}
