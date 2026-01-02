"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

const MAX_FILE_MB = 5;

// ✅ نفس البكت اللي يستخدمه الأدمن لعرض PDF
const LICENSE_BUCKET = "doctor_licenses";

type DoctorRow = {
  profile_id: string;
  specialty_id: number | null;
  rank_id: number | null;
  is_approved: boolean | null;
  licence_path: string | null;
};

type Specialty = { id: number; name_ar: string | null; name_en: string | null };
type Rank = { id: number; name_ar: string | null; name_en: string | null };

type VerificationReq = {
  id: string;
  doctor_id: string;
  licence_object_path: string | null;
  licence_mime: string | null;
  licence_size_bytes: number | null;
  status: string | null; // pending/approved/rejected
  notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

export default function DoctorPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busyUpload, setBusyUpload] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<DoctorRow | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [req, setReq] = useState<VerificationReq | null>(null);

  const [file, setFile] = useState<File | null>(null);

  const specialtyName = useMemo(() => {
    if (!doctor?.specialty_id) return "-";
    const s = specialties.find((x) => x.id === doctor.specialty_id);
    return s?.name_ar || s?.name_en || "-";
  }, [doctor?.specialty_id, specialties]);

  const rankName = useMemo(() => {
    if (!doctor?.rank_id) return "-";
    const r = ranks.find((x) => x.id === doctor.rank_id);
    return r?.name_ar || r?.name_en || "-";
  }, [doctor?.rank_id, ranks]);

  const statusLabel = useMemo(() => {
    const s = (req?.status || "").toLowerCase();
    if (doctor?.is_approved) return { text: "✅ الطبيب معتمد", cls: "text-green-700" };
    if (s === "approved") return { text: "✅ تم اعتماد الطلب (بانتظار تفعيل الطبيب)", cls: "text-green-700" };
    if (s === "rejected") return { text: "❌ مرفوض", cls: "text-red-700" };
    if (s === "pending") return { text: "⏳ قيد المراجعة", cls: "text-amber-700" };
    return { text: "⚠️ لم يتم رفع شهادة بعد", cls: "text-slate-700" };
  }, [req?.status, doctor?.is_approved]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      // 1) لازم session فعلي
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        setError(sessErr.message);
        setLoading(false);
        return;
      }
      if (!sessData.session) {
        router.push("/auth/login");
        return;
      }

      const uid = sessData.session.user.id;
      setUserId(uid);

      // 2) جلب القوائم
      const [{ data: spData, error: spErr }, { data: rkData, error: rkErr }] = await Promise.all([
        supabase.from("specialties").select("id,name_ar,name_en"),
        supabase.from("doctor_ranks").select("id,name_ar,name_en"),
      ]);

      if (spErr) {
        setError(spErr.message);
        setLoading(false);
        return;
      }
      if (rkErr) {
        setError(rkErr.message);
        setLoading(false);
        return;
      }

      setSpecialties(spData || []);
      setRanks(rkData || []);

      // 3) جلب بيانات الطبيب
      const { data: docData, error: docErr } = await supabase
        .from("doctors")
        .select("profile_id,specialty_id,rank_id,is_approved,licence_path")
        .eq("profile_id", uid)
        .maybeSingle();

      if (docErr) {
        setError(docErr.message);
        setLoading(false);
        return;
      }
      setDoctor(docData || null);

      // 4) آخر طلب تحقق للطبيب
      const { data: reqData, error: reqErr } = await supabase
        .from("doctor_verification_requests")
        .select("id,doctor_id,licence_object_path,licence_mime,licence_size_bytes,status,notes,submitted_at,reviewed_at")
        .eq("doctor_id", uid)
        .order("submitted_at", { ascending: false })
        .limit(1);

      if (reqErr) {
        setError(reqErr.message);
        setLoading(false);
        return;
      }

      setReq(reqData?.[0] || null);

      setLoading(false);
    })();
  }, [router]);

  async function refreshRequest(uid: string) {
    const { data, error } = await supabase
      .from("doctor_verification_requests")
      .select("id,doctor_id,licence_object_path,licence_mime,licence_size_bytes,status,notes,submitted_at,reviewed_at")
      .eq("doctor_id", uid)
      .order("submitted_at", { ascending: false })
      .limit(1);

    if (!error) setReq(data?.[0] || null);
  }

  async function handleUpload() {
    setError("");

    try {
      if (!userId) throw new Error("لا يوجد Session فعّال. سجّل دخول أولاً.");
      if (!file) throw new Error("اختر ملف PDF للشهادة.");
      if (file.type !== "application/pdf") throw new Error("الملف يجب أن يكون PDF فقط.");
      if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error("حجم الملف أكبر من المسموح (5MB).");

      setBusyUpload(true);

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("الجلسة غير فعّالة الآن، أعد تسجيل الدخول.");

      // ✅ المسار داخل bucket: userId/filename.pdf
      const objectPath = `${userId}/${Date.now()}.pdf`;

      // ✅ رفع داخل bucket الصحيح
      const { error: upErr } = await supabase.storage
        .from(LICENSE_BUCKET)
        .upload(objectPath, file, {
          contentType: "application/pdf",
          upsert: false,
          cacheControl: "3600",
        });

      if (upErr) throw upErr;

      // ✅ سجل طلب تحقق
      const { error: insErr } = await supabase.from("doctor_verification_requests").insert({
        doctor_id: userId,
        licence_object_path: objectPath, // ✅ نخزن المسار داخل bucket فقط
        licence_mime: "application/pdf",
        licence_size_bytes: file.size,
        status: "pending",
      });

      if (insErr) throw insErr;

      // ✅ اختياري: تحديث doctors.licence_path
      // (قد يفشل بسبب RLS — لا نخلي الفشل يوقف العملية)
      try {
        await supabase.from("doctors").update({ licence_path: objectPath }).eq("profile_id", userId);
      } catch {
        // ignore
      }

      setFile(null);
      await refreshRequest(userId);
    } catch (e: any) {
      setError(e?.message || "فشل رفع الملف");
    } finally {
      setBusyUpload(false);
    }
  }

  if (loading) {
    return <div className="p-6">جاري التحميل...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">صفحة الطبيب</h1>
          <p className={`mt-2 font-medium ${statusLabel.cls}`}>{statusLabel.text}</p>

          {req?.notes ? (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">ملاحظات المدير:</span> {req.notes}
            </p>
          ) : null}
        </div>

        <button
          onClick={() => supabase.auth.signOut().then(() => router.push("/auth/login"))}
          className="rounded-xl px-4 py-2 border border-slate-200 hover:bg-slate-50"
        >
          تسجيل خروج
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="text-lg font-semibold">بيانات الطبيب</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-slate-500">التخصص</div>
            <div className="font-semibold">{specialtyName}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-slate-500">الدرجة</div>
            <div className="font-semibold">{rankName}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-slate-500">اعتماد الطبيب</div>
            <div className="font-semibold">{doctor?.is_approved ? "نعم" : "لا"}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-slate-500">حالة طلب الشهادة</div>
            <div className="font-semibold">{req?.status || "-"}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="text-lg font-semibold">رفع شهادة مزاولة المهنة (PDF)</div>

        {error ? <div className="text-red-700 font-medium">{error}</div> : null}

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <button
            onClick={handleUpload}
            disabled={busyUpload}
            className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busyUpload ? "جاري الرفع..." : "رفع الشهادة"}
          </button>
        </div>

        <div className="text-sm text-slate-600">الحد الأقصى: {MAX_FILE_MB}MB — PDF فقط.</div>

        {req?.licence_object_path ? (
          <div className="text-sm">
            <div className="text-slate-500">آخر ملف مرفوع (داخل bucket {LICENSE_BUCKET}):</div>
            <div className="font-mono break-all">{req.licence_object_path}</div>
          </div>
        ) : null}
      </div>

      <div className="text-xs text-slate-500">
        * ملاحظة i18n: لاحقًا استبدل النصوص بمفاتيح ترجمة حسب نظام تعدد اللغات عندك.
      </div>
    </div>
  );
}
