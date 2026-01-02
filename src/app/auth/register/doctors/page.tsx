// src/app/auth/register/doctors/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

const MAX_FILE_SIZE_MB = 5;

type Department = {
  id: number;
  name_ar: string | null;
  name_en: string | null;
};

type Specialty = {
  id: number;
  name_ar: string | null;
  name_en: string | null;
  department_id: number | null;
};

type DoctorRank = {
  id: number;
  name_ar: string | null;
  name_en: string | null;
};

export default function DoctorRegisterPage() {
  const router = useRouter();

  // ✅ الحقول المطلوبة
  const [fullName, setFullName] = useState("");
  const [nationality, setNationality] = useState("");
  const [gender, setGender] = useState(""); // "male" | "female"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ اختياري
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [bio, setBio] = useState("");

  // ✅ القوائم
  const [departments, setDepartments] = useState<Department[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [ranks, setRanks] = useState<DoctorRank[]>([]);

  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [specialtyId, setSpecialtyId] = useState<number | "">("");
  const [rankId, setRankId] = useState<number | "">("");

  // ✅ شهادة مزاولة المهنة
  const [licenseFile, setLicenseFile] = useState<File | null>(null);

  // ✅ حالات
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredSpecialties = useMemo(() => {
    if (!departmentId) return [];
    return specialties.filter((s) => s.department_id === departmentId);
  }, [departmentId, specialties]);

  useEffect(() => {
    // تحميل الأقسام + التخصصات + الدرجات
    (async () => {
      try {
        const [depRes, specRes, rankRes] = await Promise.all([
          supabase.from("departments").select("id,name_ar,name_en").order("id", { ascending: true }),
          supabase
            .from("specialties")
            .select("id,name_ar,name_en,department_id")
            .order("id", { ascending: true }),
          supabase.from("doctor_ranks").select("id,name_ar,name_en").order("id", { ascending: true }),
        ]);

        if (depRes.error) console.error(depRes.error);
        if (specRes.error) console.error(specRes.error);
        if (rankRes.error) console.error(rankRes.error);

        setDepartments(depRes.data || []);
        setSpecialties(specRes.data || []);
        setRanks(rankRes.data || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // لما يتغير القسم نخلي التخصص فاضي إذا ماعاد ينطبق
  useEffect(() => {
    if (!departmentId) {
      setSpecialtyId("");
      return;
    }
    if (specialtyId && !filteredSpecialties.some((s) => s.id === specialtyId)) {
      setSpecialtyId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  function validateFile(file: File) {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return "الملف يجب أن يكون PDF فقط.";

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_SIZE_MB) {
      return `حجم الملف كبير. الحد الأقصى ${MAX_FILE_SIZE_MB}MB.`;
    }
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      // ✅ تحقق أساسي
      if (
        !fullName.trim() ||
        !nationality.trim() ||
        !gender ||
        !username.trim() ||
        !email.trim() ||
        !password ||
        !departmentId ||
        !specialtyId ||
        !rankId
      ) {
        setErrorMessage("الرجاء تعبئة جميع الحقول المطلوبة.");
        setLoading(false);
        return;
      }

      if (!licenseFile) {
        setErrorMessage("الرجاء رفع شهادة مزاولة المهنة (PDF).");
        setLoading(false);
        return;
      }

      const fileErr = validateFile(licenseFile);
      if (fileErr) {
        setErrorMessage(fileErr);
        setLoading(false);
        return;
      }

      // ✅ تأكد أن اليوزرنيم غير مستخدم
      {
        const { data: existing, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username.trim())
          .maybeSingle();

        if (error) console.error(error);

        if (existing?.id) {
          setErrorMessage("اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.");
          setLoading(false);
          return;
        }
      }

      // ✅ 1) إنشاء مستخدم Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // تقدر تستفيد منها لاحقًا (بدون تعديل جداول)
          data: {
            full_name: fullName.trim(),
            username: username.trim(),
            role: "doctor",
          },
        },
      });

      if (signUpError) {
        setErrorMessage(signUpError.message || "فشل إنشاء الحساب.");
        setLoading(false);
        return;
      }

      const uid = signUpData.user?.id;
      if (!uid) {
        setErrorMessage("لم يتم الحصول على معرف المستخدم بعد التسجيل.");
        setLoading(false);
        return;
      }

      // ✅ 2) إدراج/تحديث profiles (أعمدة مؤكدة عندك)
      {
        const { error: profErr } = await supabase.from("profiles").upsert(
          {
            id: uid,
            username: username.trim(),
            full_name: fullName.trim(),
            email: email.trim(),
            is_doctor: true,
            whatsapp_number: whatsappNumber.trim() || null,
          },
          { onConflict: "id" }
        );

        if (profErr) {
          setErrorMessage(profErr.message || "فشل حفظ بيانات الحساب.");
          setLoading(false);
          return;
        }
      }

      // ✅ 3) رفع شهادة مزاولة المهنة إلى Storage
      // لازم يكون أول جزء من name هو uid
      const objectPath = `${uid}/${Date.now()}.pdf`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("doctor_licenses")
        .upload(objectPath, licenseFile, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadErr) {
        setErrorMessage(uploadErr.message || "فشل رفع شهادة مزاولة المهنة.");
        setLoading(false);
        return;
      }

      const licenseObjectPath = uploadData?.path || objectPath;

      // ✅ 4) إدراج سجل الطبيب في doctors
      {
        const { error: docErr } = await supabase.from("doctors").upsert(
          {
            profile_id: uid,
            licence_path: licenseObjectPath,
            specialty_id: Number(specialtyId),
            rank_id: Number(rankId),
            is_approved: false,
          },
          { onConflict: "profile_id" }
        );

        if (docErr) {
          setErrorMessage(docErr.message || "فشل حفظ بيانات الطبيب.");
          setLoading(false);
          return;
        }
      }

      // ✅ 5) إنشاء طلب تحقق (للمدير)
      {
        const notesPayload = {
          nationality: nationality.trim(),
          gender,
          bio: bio.trim() || null,
          department_id: Number(departmentId),
          specialty_id: Number(specialtyId),
          rank_id: Number(rankId),
        };

        const { error: reqErr } = await supabase.from("doctor_verification_requests").insert({
          doctor_id: uid,
          licence_object_path: licenseObjectPath,
          licence_mime: "application/pdf",
          licence_size_bytes: licenseFile.size,
          status: "pending",
          notes: JSON.stringify(notesPayload),
        });

        // لو فشل الإدراج هنا، ما نخرب التسجيل الأساسي (لكن نبلغك)
        if (reqErr) {
          console.error(reqErr);
        }
      }

      setLoading(false);
      setSuccessMessage("تم إنشاء حساب الطبيب بنجاح ✅ (بانتظار اعتماد المدير العام).");

      // ✅ التحويل الآمن والسريع لصفحة "تحت المراجعة"
      // (UI فقط - بدون أي DB/RLS)
      router.replace("/doctor/pending");
    } catch (err) {
      console.error(err);
      setErrorMessage("حدث خطأ غير متوقع أثناء تسجيل الطبيب.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-md border border-slate-200 p-8 text-right">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 text-center">
          تسجيل طبيب جديد
        </h1>
        <p className="text-sm text-slate-600 mb-6 text-center">
          أنشئ حساب طبيب وارفع شهادة مزاولة المهنة (PDF).
        </p>

        {errorMessage && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-2xl bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="اسم الطبيب الكامل *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <input
            type="text"
            placeholder="الجنسية *"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">الجنس *</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>

          <input
            type="text"
            placeholder="اسم المستخدم (Username) *"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <input
            type="email"
            placeholder="البريد الإلكتروني *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <input
            type="password"
            placeholder="كلمة المرور *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <textarea
            placeholder="نبذة تعريفية (اختياري)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <input
            type="text"
            placeholder="رقم الواتساب (اختياري)"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">القسم *</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_ar || d.name_en || `قسم #${d.id}`}
              </option>
            ))}
          </select>

          <select
            value={specialtyId}
            onChange={(e) => setSpecialtyId(e.target.value ? Number(e.target.value) : "")}
            disabled={!departmentId}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
          >
            <option value="">{departmentId ? "التخصص *" : "اختر القسم أولاً"}</option>
            {filteredSpecialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar || s.name_en || `تخصص #${s.id}`}
              </option>
            ))}
          </select>

          <select
            value={rankId}
            onChange={(e) => setRankId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">الدرجة *</option>
            {ranks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name_ar || r.name_en || `درجة #${r.id}`}
              </option>
            ))}
          </select>

          <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3">
            <label className="block text-xs text-slate-600 mb-2">
              رفع شهادة مزاولة المهنة (PDF فقط) * — (حد أقصى {MAX_FILE_SIZE_MB}MB)
            </label>

            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                if (!f) {
                  setLicenseFile(null);
                  return;
                }
                const err = validateFile(f);
                if (err) {
                  setErrorMessage(err);
                  setLicenseFile(null);
                  return;
                }
                setErrorMessage("");
                setLicenseFile(f);
              }}
              className="w-full text-sm"
            />

            {licenseFile && (
              <p className="mt-2 text-xs text-slate-600">
                الملف المختار: <span className="font-semibold">{licenseFile.name}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white py-3 font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "جاري إنشاء الحساب..." : "تسجيل طبيب جديد"}
          </button>

          <div className="text-xs text-slate-600 text-center mt-2">
            لديك حساب؟{" "}
            <a href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              تسجيل الدخول
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
