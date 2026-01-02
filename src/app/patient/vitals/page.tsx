"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

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

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

function toNum(v: string) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export default function PatientVitalsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const consultationId = useMemo(() => {
    const raw = sp.get("consultation_id") ?? "";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [sp]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [temp, setTemp] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [sugar, setSugar] = useState("");

  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const { data: uRes } = await supabase.auth.getUser();
        const uid = uRes?.user?.id ?? null;

        if (!uid) {
          router.push("/auth/login");
          return;
        }

        if (!alive) return;
        setMeId(uid);

        const { data: pRow } = await supabase
          .from("profiles")
          .select("id,full_name,username")
          .eq("id", uid)
          .maybeSingle();

        if (!alive) return;
        setProfile((pRow ?? null) as ProfileRow | null);

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
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

  async function saveVitals() {
    setErr("");

    try {
      if (!meId) throw new Error("يجب تسجيل الدخول أولاً.");
      setBusy(true);

      const now = new Date().toISOString();
      const rows: PatientVitalInsert[] = [];

      const t = toNum(temp);
      if (t != null) {
        rows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "temperature",
          value_numeric: t,
          value2_numeric: null,
          unit: "C",
          recorded_at: now,
        });
      }

      const sys = toNum(bpSys);
      const dia = toNum(bpDia);

      // ✅ مهم: ضغط الدم لازم SYS + DIA معًا (حسب vitals_value_rules)
      if ((sys != null && dia == null) || (sys == null && dia != null)) {
        throw new Error("ضغط الدم: أدخل الانقباضي والانبساطي معًا (SYS + DIA).");
      }
      if (sys != null && dia != null) {
        rows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "blood_pressure",
          value_numeric: sys,
          value2_numeric: dia,
          unit: "mmHg",
          recorded_at: now,
        });
      }

      const w = toNum(weight);
      if (w != null) {
        rows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "weight",
          value_numeric: w,
          value2_numeric: null,
          unit: "kg",
          recorded_at: now,
        });
      }

      const h = toNum(height);
      if (h != null) {
        rows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "height",
          value_numeric: h,
          value2_numeric: null,
          unit: "cm",
          recorded_at: now,
        });
      }

      const s = toNum(sugar);
      if (s != null) {
        // ✅ في DB مسموح "glucose"
        rows.push({
          patient_id: meId,
          recorded_by: meId,
          vital_type: "glucose",
          value_numeric: s,
          value2_numeric: null,
          unit: "mg/dL",
          recorded_at: now,
        });
      }

      if (rows.length === 0 && files.length === 0) {
        throw new Error("أدخل قيمة واحدة على الأقل أو ارفع تحاليل.");
      }

      if (rows.length) {
        const { error } = await supabase.from("patient_vitals").insert(rows);
        if (error) throw error;
      }

      if (files.length) {
        const bucket = "clinic";
        const uploaded: Array<{ storage_path: string; mime_type: string; file_size: number }> = [];

        for (const f of files) {
          const ext = f.name.split(".").pop() || "bin";
          const path = `patient_vitals/${meId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(path, f, { contentType: f.type || "application/octet-stream" });

          if (upErr) throw upErr;

          uploaded.push({
            storage_path: path,
            mime_type: f.type || "application/octet-stream",
            file_size: f.size,
          });
        }

        if (consultationId) {
          const consultationFiles = uploaded.map((u) => {
            const publicUrl =
              supabase.storage.from(bucket).getPublicUrl(u.storage_path)?.data?.publicUrl ?? null;
            return {
              consultation_id: consultationId,
              sender_id: meId,
              kind: "lab_image",
              object_path: `${bucket}/${u.storage_path}`,
              url: publicUrl,
              title: "تحاليل",
              mime: u.mime_type,
              size_bytes: u.file_size,
            };
          });

          const { error: cfErr } = await supabase.from("consultation_files").insert(consultationFiles);
          if (cfErr) {
            setErr("✅ تم حفظ العلامات الحيوية ورفع التحاليل. لكن إدخالها في consultation_files فشل (RLS). سنضبطه لاحقًا بشكل آمن.");
          }
        }
      }

      setTemp("");
      setBpSys("");
      setBpDia("");
      setWeight("");
      setHeight("");
      setSugar("");
      setFiles([]);

      if (!err) alert("✅ تم حفظ العلامات الحيوية بنجاح.");
    } catch (e: any) {
      setErr(e?.message ?? "فشل حفظ العلامات الحيوية.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen">
        {/* ✅ سواد 50% */}
        <div className="pointer-events-none absolute inset-0 bg-black/50" />
        <div className="relative p-6 text-white">جاري التحميل…</div>
      </div>
    );
  }

  const name =
    safeText(profile?.full_name) !== "—" ? safeText(profile?.full_name) : safeText(profile?.username);

  return (
    <div className="relative min-h-screen">
      {/* ✅ سواد 50% */}
      <div className="pointer-events-none absolute inset-0 bg-black/50" />

      <div className="relative max-w-3xl mx-auto p-6 space-y-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">العلامات الحيوية</h1>
            <div className="mt-1 text-sm text-white/70">
              الاسم: <span className="font-semibold text-white">{name}</span>
            </div>
            {consultationId ? (
              <div className="mt-1 text-xs text-white/60">
                وضع المقابلة: سيتم محاولة إرسال التحاليل لغرفة الطبيب عبر consultation_files (إن سمحت RLS).
              </div>
            ) : null}
          </div>

          <button
            onClick={() => router.back()}
            className="rounded-xl px-4 py-2 border border-white/15 bg-white/5 hover:bg-white/10"
          >
            رجوع
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {err}
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 p-5 bg-white/5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-semibold mb-1">الحرارة (°C)</div>
              <input
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                placeholder="مثال: 37.2"
                inputMode="decimal"
              />
            </div>

            <div>
              <div className="text-sm font-semibold mb-1">ضغط الدم (mmHg)</div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-extrabold">
                    1
                  </span>
                  <div className="text-xs text-white/70">الانقباضي (SYS) — الرقم الأول</div>
                </div>
                <input
                  value={bpSys}
                  onChange={(e) => setBpSys(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                  placeholder="مثال: 120"
                  inputMode="numeric"
                />

                <div className="pt-1 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-extrabold">
                    2
                  </span>
                  <div className="text-xs text-white/70">الانبساطي (DIA) — الرقم الثاني</div>
                </div>
                <input
                  value={bpDia}
                  onChange={(e) => setBpDia(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                  placeholder="مثال: 80"
                  inputMode="numeric"
                />

                <div className="text-[12px] text-white/60 pt-1">
                  * يجب إدخال الرقمين معًا حتى يتم الحفظ.
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-1">الوزن (kg)</div>
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                placeholder="مثال: 72"
                inputMode="decimal"
              />
            </div>

            <div>
              <div className="text-sm font-semibold mb-1">الطول (cm)</div>
              <input
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                placeholder="مثال: 170"
                inputMode="decimal"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-semibold mb-1">قياس السكر (mg/dL)</div>
              <input
                value={sugar}
                onChange={(e) => setSugar(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none text-white placeholder:text-white/40"
                placeholder="مثال: 110"
                inputMode="decimal"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-semibold mb-2">إرفاق صور تحاليل (متعددة)</div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={onPickFiles}
                className="block w-full text-sm text-white/80"
              />
              {files.length ? (
                <div className="mt-2 text-xs text-white/60">
                  تم اختيار: <span className="font-semibold text-white">{files.length}</span> ملف
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={saveVitals}
              disabled={busy}
              className="rounded-xl px-5 py-3 bg-white text-black hover:bg-white/90 disabled:opacity-60 font-extrabold"
            >
              {busy ? "جاري الحفظ…" : "حفظ"}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 leading-7">
            <div className="font-extrabold text-white mb-2">ملاحظة مهمة</div>
            <div>
              ضغط الدم الانقباضي: هو الرقم الأول في قراءة الضغط، ويعبر عن ضغط الدم الذي ينشأ عندما تنقبض عضلة القلب،
              حيث يكون ضغط الدم في أعلى مستوياته
            </div>
            <div className="mt-2">
              ضغط الدم الانبساطي: هو الرقم الثاني في قراءة الضغط، ويعبر عن ضغط الدم الذي ينشأ أثناء راحة القلب بين
              النبضات، حيث يكون ضغط الدم في أقل مستوياته.
            </div>
          </div>

          <div className="text-xs text-white/50">
            i18n: استبدل النصوص بمفاتيح الترجمة حسب نظام تعدد اللغات عندك.
          </div>
        </div>
      </div>
    </div>
  );
}
