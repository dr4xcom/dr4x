// src/app/auth/forgot/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSend() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const e = email.trim();
      if (!e) throw new Error("اكتب البريد الإلكتروني.");
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/confirm`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo,
      });
      if (error) throw error;

      setMsg("تم إرسال رابط تغيير كلمة المرور إلى بريدك (إذا كان الحساب موجود).");
    } catch (e: any) {
      setErr(e?.message || "فشل الإرسال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="mb-4">
        <div className="text-sm text-slate-500">DR4X</div>
        <div className="text-2xl font-extrabold text-slate-900">نسيت كلمة المرور</div>
      </div>

      <div className="dr4x-card p-4">
        {err ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}
        {msg ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {msg}
          </div>
        ) : null}

        <label className="block mb-3">
          <div className="mb-1 text-xs font-bold text-slate-600">البريد الإلكتروني</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="name@email.com"
          />
        </label>

        <button
          onClick={onSend}
          disabled={loading}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "جارٍ الإرسال..." : "إرسال الرابط"}
        </button>

        <div className="mt-3 text-xs text-slate-600">
          <Link className="underline" href="/auth/login">رجوع للدخول</Link>
        </div>
      </div>
    </div>
  );
}
