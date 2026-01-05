"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export default function PatientRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [nationality, setNationality] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [age, setAge] = useState<string>("");
  const [bloodType, setBloodType] = useState<(typeof BLOOD_TYPES)[number] | "">(
    ""
  );
  const [chronicConditions, setChronicConditions] = useState<string>("");

  function validate() {
    if (!fullName.trim()) return "اكتب الاسم الكامل.";
    if (!username.trim()) return "اكتب اسم المستخدم (username).";
    if (!email.trim()) return "اكتب البريد الإلكتروني.";
    if (email.trim().toLowerCase().startsWith("www."))
      return "البريد الإلكتروني غير صحيح (لا تكتب www. قبل البريد).";
    if (!password || password.length < 6)
      return "كلمة المرور يجب أن تكون 6 أحرف على الأقل.";
    if (!nationality.trim()) return "اكتب الجنسية.";
    if (!age.trim()) return "اكتب العمر.";

    const n = Number(age);
    if (!Number.isFinite(n) || n <= 0 || n > 120) return "العمر غير صحيح.";
    if (!bloodType) return "اختر فصيلة الدم.";

    return null;
  }

  async function onSubmit() {
    setErr(null);
    setMsg(null);

    const v = validate();
    if (v) return setErr(v);

    setLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/confirm`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName.trim(),
            username: username.trim(),
            role: "patient",
          },
        },
      });

      if (error) throw error;

      const uid = data.user?.id;
      if (!uid) throw new Error("لم يتم إنشاء المستخدم (uid).");

      const payload: any = {
        uid,
        mode: "patient",
        profile: {
          id: uid,
          full_name: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          is_doctor: false,
        },
        patient: {
          nationality: nationality.trim(),
          gender,
          blood_type: bloodType || null,
          chronic_conditions: chronicConditions.trim() || null,
          age: Number(age),
        },
      };

      const res = await fetch("/api/auth/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || "فشل إنشاء بيانات الحساب.");

      setMsg("تم إنشاء حساب المريض ✅ تقدر الآن تروح لتسجيل الدخول.");
      setTimeout(() => router.push("/auth/login"), 600);
    } catch (e: any) {
      setErr(e?.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 min-h-screen bg-black text-emerald-400">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-emerald-500">DR4X</div>
            <div className="text-2xl font-extrabold text-emerald-400">
              إنشاء حساب مريض
            </div>
            <div className="mt-1 text-xs text-emerald-600">
              روابط مهمة: <span className="font-mono">/auth/login</span>{" "}
              <span className="text-emerald-700">|</span>{" "}
              <span className="font-mono">/auth/register</span>{" "}
              <span className="text-emerald-700">|</span>{" "}
              <span className="font-mono">/auth/register/patients</span>
            </div>
          </div>

          <Link
            href="/auth/login"
            className="rounded-xl border border-emerald-600 bg-black px-3 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-900/20"
          >
            عندك حساب؟ دخول
          </Link>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-700 bg-black/70">
          {err ? (
            <div className="mb-4 rounded-xl border border-red-500 bg-red-900/40 p-3 text-sm text-red-300">
              {err}
            </div>
          ) : null}

          {msg ? (
            <div className="mb-4 rounded-xl border border-emerald-500 bg-emerald-900/40 p-3 text-sm text-emerald-300">
              {msg}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              label="الاسم الكامل"
              value={fullName}
              onChange={setFullName}
              placeholder="مثال: محمد أحمد"
            />
            <Field
              label="اسم المستخدم (username)"
              value={username}
              onChange={setUsername}
              placeholder="مثال: dr4x"
            />

            <Select
              label="الجنس"
              value={gender}
              onChange={(v: "male" | "female") => setGender(v)}
              options={[
                { value: "male", label: "ذكر" },
                { value: "female", label: "أنثى" },
              ]}
            />

            <Field
              label="الجنسية"
              value={nationality}
              onChange={setNationality}
              placeholder="مثال: سعودي"
            />

            <Field
              label="البريد الإلكتروني"
              value={email}
              onChange={setEmail}
              placeholder="name@email.com"
              type="email"
            />

            <Field
              label="كلمة المرور"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              type="password"
            />
          </div>

          <div className="mt-5">
            <div className="text-sm font-extrabold text-emerald-300 mb-2">
              بيانات المريض
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="العمر"
                value={age}
                onChange={setAge}
                placeholder="مثال: 28"
                type="number"
              />

              <Select
                label="فصيلة الدم"
                value={bloodType}
                onChange={(v: (typeof BLOOD_TYPES)[number] | "") =>
                  setBloodType(v)
                }
                options={[
                  { value: "", label: "اختر..." },
                  ...BLOOD_TYPES.map((b) => ({ value: b, label: b })),
                ]}
              />

              <TextArea
                label="الأمراض المزمنة (اختياري)"
                value={chronicConditions}
                onChange={setChronicConditions}
                placeholder="مثال: سكري، ضغط..."
              />
            </div>
          </div>

          <button
            onClick={onSubmit}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-black hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? "جارٍ إنشاء الحساب..." : "إنشاء حساب مريض"}
          </button>

          <div className="mt-3 text-xs text-emerald-600">
            بإكمال التسجيل أنت توافق على سياسات الموقع.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- العناصر المساعدة ---------- */

function Field({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-bold text-emerald-400">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-emerald-700 bg-black px-3 py-2 text-base text-emerald-200 outline-none focus:border-emerald-400"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: any) {
  return (
    <label className="block md:col-span-2">
      <div className="mb-1 text-xs font-bold text-emerald-400">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-xl border border-emerald-700 bg-black px-3 py-2 text-base text-emerald-200 outline-none focus:border-emerald-400"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-bold text-emerald-400">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-emerald-700 bg-black px-3 py-2 text-base text-emerald-200 outline-none focus:border-emerald-400"
      >
        {options.map((o: any) => (
          <option key={o.value || o.label} value={o.value} className="bg-black">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
