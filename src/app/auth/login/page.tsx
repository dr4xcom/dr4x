// src/app/auth/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import InstallPwaButton from "@/components/InstallPwaButton";

export default function LoginPage() {
  const router = useRouter();

  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      if (!loginValue.trim() || !password) {
        setErrorMessage("الرجاء إدخال البريد أو الاسم المستعار وكلمة المرور.");
        setLoading(false);
        return;
      }

      let emailToUse = loginValue.trim();

      if (!emailToUse.includes("@")) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", emailToUse)
          .maybeSingle();

        if (!profile?.email) {
          setErrorMessage("لم يتم العثور على حساب بهذا الاسم.");
          setLoading(false);
          return;
        }

        emailToUse = profile.email;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error) {
        setErrorMessage("بيانات الدخول غير صحيحة.");
        setLoading(false);
        return;
      }

      setLoading(false);
      router.push("/home");
    } catch {
      setErrorMessage("حدث خطأ غير متوقع.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-md border border-slate-200 p-8 text-right relative overflow-hidden">

        {/* ✨ انعكاس الضوء */}
        <div className="glow-overlay" />

        {/* 🚨 شريط السفتي */}
        <div className="flex justify-center mb-3">
          <div className="animate-police" />
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 text-center">
          تسجيل الدخول إلى DR4X
        </h1>

        <p className="text-sm text-slate-600 mb-6 text-center">
          ادخل باستخدام البريد الإلكتروني أو الاسم المستعار، ثم كلمة المرور.
        </p>

        <div className="mb-4 flex justify-center">
          <InstallPwaButton />
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="البريد الإلكتروني أو الاسم المستعار"
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50"
          />

          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm bg-slate-50"
          />

          <div className="flex justify-between text-xs text-slate-600">
            <span />
            <a href="/auth/forgot" className="text-blue-600 font-semibold">
              نسيت كلمة المرور؟
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-blue-600 text-white py-3 font-semibold text-sm"
          >
            {loading ? "جاري تسجيل الدخول..." : "دخول"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500 mb-3 text-center">
            لا تملك حسابًا؟
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/auth/register/doctors"
              className="flex-1 text-center rounded-2xl border border-blue-600 text-blue-600 py-2 text-sm font-semibold"
            >
              تسجيل طبيب
            </a>

            <a
              href="/auth/register/patients"
              className="flex-1 text-center rounded-2xl border border-slate-300 text-slate-700 py-2 text-sm font-semibold"
            >
              تسجيل مريض / عضو
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
