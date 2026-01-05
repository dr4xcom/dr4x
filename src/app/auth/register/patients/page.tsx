// src/app/auth/register/patients/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export default function PatientRegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [nationality, setNationality] = useState("");
  const [bloodType, setBloodType] = useState<string>("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [age, setAge] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error("الرجاء إدخال البريد الإلكتروني وكلمة المرور");
      }

      // 1) إنشاء المستخدم في Supabase Auth
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      const user = signUpData.user;
      if (!user) {
        throw new Error("تعذر الحصول على بيانات المستخدم بعد التسجيل");
      }

      const uid = user.id;

      // 2) استدعاء API الخاص بالـ onboard (يستخدم service role)
      const res = await fetch("/api/auth/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          mode: "patient",
          profile: {
            username: username || null,
            full_name: fullName || null,
            email: email || null,
            whatsapp_number: whatsappNumber || null,
            is_doctor: false,
          },
          patient: {
            nationality: nationality || null,
            gender:
              gender === "male"
                ? "male"
                : gender === "female"
                ? "female"
                : null,
            blood_type: bloodType || null,
            chronic_conditions: chronicConditions || null,
            height_cm: heightCm || null,
            weight_kg: weightKg || null,
            age: age || null,
          },
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "حدث خطأ أثناء إنشاء ملف المريض");
      }

      setSuccessMsg("تم إنشاء حساب المريض بنجاح، يمكنك الآن تسجيل الدخول.");
      // ممكن تحويل مباشر لصفحة الدخول
      setTimeout(() => {
        router.push("/auth/login");
      }, 1500);
    } catch (err: any) {
      console.error("patient register error:", err);
      setErrorMsg(err?.message || "حدث خطأ غير متوقع أثناء التسجيل");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-slate-50 py-10 px-4">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">إنشاء حساب مريض</h1>
          <Link
            href="/auth/login"
            className="text-sm text-blue-600 hover:underline"
          >
            عندك حساب؟ دخول
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-4">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* الاسم / اليوزر / واتساب */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-slate-700">الاسم الكامل</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-700">(username) اسم المستخدم</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-slate-700">رقم الواتساب</label>
                <input
                  type="tel"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
              </div>
            </div>

            {/* البريد / كلمة المرور */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-slate-700">البريد الإلكتروني</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-700">كلمة المرور</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* معلومات صحية */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-slate-700">الجنس</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={gender}
                  onChange={(e) =>
                    setGender(e.target.value as "male" | "female" | "other" | "")
                  }
                >
                  <option value="">— اختر —</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-700">الجنسية</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-700">فصيلة الدم</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                >
                  <option value="">— اختر —</option>
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-700">الأمراض المزمنة (إن وجدت)</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={chronicConditions}
                  onChange={(e) => setChronicConditions(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-700">الطول (سم)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-700">الوزن (كجم)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-700">العمر</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-slate-900 text-white py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "جارٍ إنشاء الحساب..." : "إنشاء حساب مريض"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
