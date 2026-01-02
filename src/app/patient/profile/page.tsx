// src/app/patient/profile/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

/* ============ Types ============ */

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type PatientVitalInsert = {
  patient_id: string;
  recorded_by: string;
  vital_type: string;
  value_numeric?: number | null;
  value2_numeric?: number | null;
  value_text?: string | null;
  unit?: string | null;
  recorded_at: string;
};

type UploadingFile = {
  file: File;
  path: string;
};

type DepartmentOption = {
  id: string;
  label: string;
};

type SpecialtyOption = {
  id: string;
  label: string;
  department_id?: string | null;
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

function toNum(v: string) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function detectFileType(
  mime: string | null | undefined
): "image" | "pdf" | "video" | "other" {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "video";
  return "other";
}

// نحاول نطلع اسم عربي/واضح من الصف (قسم أو تخصص)
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

/* ============ Component ============ */

export default function PatientProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // الشكوى الحالية
  const [complaint, setComplaint] = useState("");

  // العلامات الحيوية
  const [temp, setTemp] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [sugar, setSugar] = useState("");

  // اختيار القسم والتخصص الدقيق
  const [departmentId, setDepartmentId] = useState("");
  const [subSpecialtyId, setSubSpecialtyId] = useState("");

  // الخيارات القادمة من قاعدة البيانات
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);

  // الملفات المرفوعة في هذه الزيارة
  const [files, setFiles] = useState<File[]>([]);

  /* ---------- تحميل بيانات المستخدم + الأقسام/التخصصات ---------- */

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;

        const uid = uRes?.user?.id ?? null;
        if (!uid) {
          router.push("/auth/login");
          return;
        }

        if (!alive) return;
        setMeId(uid);

        const { data: pRow, error: pErr } = await supabase
          .from("profiles")
          .select("id,full_name,username")
          .eq("id", uid)
          .maybeSingle();

        if (pErr) {
          console.error("profiles error", pErr);
        }

        if (!alive) return;
        setProfile((pRow ?? null) as ProfileRow | null);

        // الأقسام
        try {
          const { data: deptRows, error: deptErr } = await supabase
            .from("departments")
            .select("id, name_ar, name_en");

          if (!alive) return;

          if (deptErr) {
            console.error("departments error", deptErr);
          } else if (Array.isArray(deptRows)) {
            const mapped: DepartmentOption[] = deptRows.map((row: any) => ({
              id: String(row.id),
              label: inferLabel(row),
            }));
            setDepartments(mapped);
          }
        } catch (e) {
          console.error("departments fetch error", e);
        }

        // التخصصات الدقيقة
        try {
          const { data: specRows, error: specErr } = await supabase
            .from("specialties")
            .select("id, department_id, name_ar, name_en");

          if (!alive) return;

          if (specErr) {
            console.error("specialties error", specErr);
          } else if (Array.isArray(specRows)) {
            const mapped: SpecialtyOption[] = specRows.map((row: any) => ({
              id: String(row.id),
              label: inferLabel(row),
              department_id:
                row.department_id != null ? String(row.department_id) : undefined,
            }));
            setSpecialties(mapped);
          }
        } catch (e) {
          console.error("specialties fetch error", e);
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error(e);
        setErr(e?.message ?? "تعذر تحميل الصفحة.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files ? Array.from(e.target.files) : [];
    setFiles(f);
  }

  const selectedDepartmentLabel = useMemo(
    () => departments.find((d) => d.id === departmentId)?.label ?? "",
    [departments, departmentId]
  );

  const availableSubSpecialties = useMemo(() => {
    if (!specialties.length) return [];
    if (!departmentId) return [];
    return specialties.filter((s) => s.department_id === departmentId);
  }, [specialties, departmentId]);

  /* ---------- حفظ العلامات الحيوية + الشكوى + الملفات ---------- */

  async function onSave() {
    setErr("");

    try {
      if (!meId) throw new Error("يجب تسجيل الدخول أولاً.");
      setSaving(true);

      const now = new Date().toISOString();
      const vitalsRows: PatientVitalInsert[] = [];

      // الشكوى الحالية كـ note (تخضع لقيد vitals_value_rules)
      if (complaint.trim().length > 0) {
        vitalsRows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "note",
          value_numeric: null,
          value2_numeric: null,
          value_text: complaint.trim(),
          unit: "complaint",
          recorded_at: now,
        });
      }

      // حرارة
      const t = toNum(temp);
      if (t != null) {
        vitalsRows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "temperature",
          value_numeric: t,
          value2_numeric: null,
          unit: "C",
          recorded_at: now,
        });
      }

      // ضغط الدم
      const sys = toNum(bpSys);
      const dia = toNum(bpDia);

      if ((sys != null && dia == null) || (sys == null && dia != null)) {
        throw new Error("ضغط الدم: يجب إدخال الانقباضي والانبساطي معًا (SYS + DIA).");
      }

      if (sys != null && dia != null) {
        vitalsRows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "blood_pressure",
          value_numeric: sys,
          value2_numeric: dia,
          unit: "mmHg",
          recorded_at: now,
        });
      }

      // وزن
      const w = toNum(weight);
      if (w != null) {
        vitalsRows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "weight",
          value_numeric: w,
          value2_numeric: null,
          unit: "kg",
          recorded_at: now,
        });
      }

      // طول
      const h = toNum(height);
      if (h != null) {
        vitalsRows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "height",
          value_numeric: h,
          value2_numeric: null,
          unit: "cm",
          recorded_at: now,
        });
      }

      // سكر
      const g = toNum(sugar);
      if (g != null) {
        vitalsRows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "glucose",
          value_numeric: g,
          value2_numeric: null,
          unit: "mg/dL",
          recorded_at: now,
        });
      }

      // 1) إدخال العلامات الحيوية
      if (vitalsRows.length > 0) {
        const { error: vErr } = await supabase.from("patient_vitals").insert(vitalsRows);
        if (vErr) throw vErr;
      }

      // 2) رفع الملفات إلى Storage + patient_files
      if (files.length > 0) {
        const bucket = "clinic";

        const uploads: UploadingFile[] = files.map((f) => {
          const ext = f.name.split(".").pop() || "bin";
          const rand = Math.random().toString(16).slice(2);
          const safeName = `patient-${meId}-${Date.now()}-${rand}.${ext}`;
          const path = `patient_files/${meId}/${safeName}`;
          return { file: f, path };
        });

        for (const up of uploads) {
          const { file, path } = up;

          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (upErr) {
            console.error("upload error", upErr);
            throw new Error("فشل رفع أحد الملفات. تأكد من السماح بالحجم والامتداد.");
          }

          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

          const fileType = detectFileType(file.type || null);
          let fileKind: string = "other";
          if (fileType === "image") fileKind = "image";
          else if (fileType === "pdf") fileKind = "report";
          else if (fileType === "video") fileKind = "video";

          // ✅ مطابق تمامًا لجدول patient_files في الصور
          const { error: pfErr } = await supabase.from("patient_files").insert({
            patient_id: meId,
            consultation_id: null, // نربطها لاحقًا بجلسة محددة داخل غرفة الكشف
            storage_path: path,
            file_type: fileKind,
            mime_type: file.type || null,
            size_bytes: file.size,
            public_url: pub?.publicUrl ?? null,
          });

          if (pfErr) {
            console.error("patient_files error", pfErr);
            // هنا لا نرمي خطأ حتى لا نفشل العملية كلها، لكن نعرض رسالة خفيفة لو حبيت لاحقاً
          }
        }
      }

      alert("✅ تم حفظ الشكوى والعلامات الحيوية والملفات بنجاح.");
      setErr("");

      // الانتقال لقائمة الأطباء
      if (departmentId && subSpecialtyId) {
        const dept = encodeURIComponent(departmentId);
        const sub = encodeURIComponent(subSpecialtyId);
        router.push(`/category?department=${dept}&sub=${sub}`);
      } else {
        setErr(
          "تم حفظ بياناتك، لكن يلزم اختيار القسم والتخصص الدقيق قبل الانتقال لقائمة الأطباء."
        );
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "فشل حفظ البيانات.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- الانتقال لقائمة الأطباء بدون حفظ جديد ---------- */

  function onGoToDoctorSelection() {
    if (!departmentId || !subSpecialtyId) {
      setErr("يرجى اختيار القسم والتخصص الدقيق قبل المتابعة لاختيار الطبيب.");
      return;
    }

    const dept = encodeURIComponent(departmentId);
    const sub = encodeURIComponent(subSpecialtyId);
    router.push(`/category?department=${dept}&sub=${sub}`);
  }

  /* ---------- واجهة المستخدم ---------- */

  if (loading) {
    return (
      <div className="relative min-h-screen bg-slate-900 text-white">
        <div className="pointer-events-none absolute inset-0 bg-black/50" />
        <div className="relative p-6 text-white">جاري التحميل…</div>
      </div>
    );
  }

  const name =
    safeText(profile?.full_name) !== "—"
      ? safeText(profile?.full_name)
      : safeText(profile?.username);

  return (
    <div className="relative min-h-screen bg-slate-900 text-white">
      {/* سواد 50% فوق الخلفية */}
      <div className="pointer-events-none absolute inset-0 bg-black/50" />

      <div className="relative max-w-4xl mx-auto p-6 space-y-4">
        {/* أعلى الصفحة */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold">ملفي الصحي</h1>
            <div className="mt-1 text-sm text-white/70">
              الاسم: <span className="font-semibold text-white">{name}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full px-4 py-2 border border-white/20 bg-white/5 hover:bg-white/10 text-sm"
          >
            رجوع
          </button>
        </div>

        {/* رسالة خطأ */}
        {err && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/15 p-4 text-sm text-red-100">
            {err}
          </div>
        )}

        {/* الشكوى الحالية */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="text-lg font-extrabold mb-1">الشكوى الحالية</div>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40 resize-none"
            placeholder="اكتب هنا وصفًا مختصرًا لسبب زيارتك الحالية للطبيب…"
          />
        </div>

        {/* العلامات الحيوية */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
          <div className="text-lg font-extrabold mb-1">العلامات الحيوية</div>
          <p className="text-xs text-white/60 mb-2">
            تم تعبئة قياساتك الحالية قبل طلب الاستشارة، ليتمكن الطبيب من رؤيتها في غرفة
            الكشف.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* الحرارة */}
            <div>
              <div className="text-sm font-semibold mb-1">الحرارة (°C)</div>
              <input
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                placeholder="مثال: 37.2"
                inputMode="decimal"
              />
            </div>

            {/* ضغط الدم */}
            <div>
              <div className="text-sm font-semibold mb-1">ضغط الدم (mmHg)</div>
              <div className="rounded-2xl border border-white/15 bg-black/25 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-extrabold">
                    1
                  </span>
                  الانقباضي (SYS) — الرقم الأول
                </div>
                <input
                  value={bpSys}
                  onChange={(e) => setBpSys(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                  placeholder="مثال: 120"
                  inputMode="numeric"
                />

                <div className="flex items-center gap-2 text-xs text-white/70 pt-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-extrabold">
                    2
                  </span>
                  الانبساطي (DIA) — الرقم الثاني
                </div>
                <input
                  value={bpDia}
                  onChange={(e) => setBpDia(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                  placeholder="مثال: 80"
                  inputMode="numeric"
                />

                <div className="text-[11px] text-white/60 pt-1">
                  * يجب إدخال الرقمين معًا حتى يتم الحفظ (حسب قواعد vitals_value_rules في
                  قاعدة البيانات).
                </div>
              </div>
            </div>

            {/* الوزن */}
            <div>
              <div className="text-sm font-semibold mb-1">الوزن (kg)</div>
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                placeholder="مثال: 72"
                inputMode="decimal"
              />
            </div>

            {/* الطول */}
            <div>
              <div className="text-sm font-semibold mb-1">الطول (cm)</div>
              <input
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                placeholder="مثال: 170"
                inputMode="decimal"
              />
            </div>

            {/* السكر */}
            <div>
              <div className="text-sm font-semibold mb-1">سكر الدم (mg/dL)</div>
              <input
                value={sugar}
                onChange={(e) => setSugar(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                placeholder="مثال: 110"
                inputMode="decimal"
              />
            </div>
          </div>
        </div>

        {/* الملفات المرفوعة */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-extrabold">ملفات وتقارير طبية</div>
            <div className="text-xs text-white/60">
              يمكنك رفع صور الأشعة، التحاليل، أو تقارير PDF
            </div>
          </div>

          <input
            type="file"
            multiple
            onChange={onPickFiles}
            className="block w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:text-sm file:font-semibold hover:file:bg-emerald-600"
          />

          {files.length > 0 && (
            <div className="text-xs text-white/70">
              عدد الملفات المختارة حالياً:{" "}
              <span className="font-bold text-emerald-300">{files.length}</span>
            </div>
          )}
        </div>

        {/* اختيار القسم والتخصص */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-lg font-extrabold mb-1">اختيار القسم والتخصص</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-semibold mb-1">القسم</div>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setSubSpecialtyId("");
                }}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none text-white"
              >
                <option value="">اختر القسم…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-sm font-semibold mb-1">التخصص الدقيق</div>
              <select
                value={subSpecialtyId}
                onChange={(e) => setSubSpecialtyId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none text-white"
                disabled={!departmentId}
              >
                <option value="">
                  {departmentId ? "اختر التخصص…" : "اختر القسم أولاً"}
                </option>
                {availableSubSpecialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedDepartmentLabel && (
            <div className="text-xs text-white/60">
              القسم المختار: <span className="font-semibold">{selectedDepartmentLabel}</span>
            </div>
          )}
        </div>

        {/* الأزرار */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "جارٍ الحفظ…" : "حفظ وإرسال للانتقال لقائمة الأطباء"}
          </button>

          <button
            type="button"
            onClick={onGoToDoctorSelection}
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold border border-white/25 bg-white/5 hover:bg-white/10"
          >
            المتابعة لاختيار الطبيب بدون حفظ جديد
          </button>
        </div>
      </div>
    </div>
  );
}
