"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSave() {
    setErr(null);
    setMsg(null);

    if (!password || password.length < 6) {
      setErr("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    if (password !== confirm) {
      setErr("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMsg("تم تغيير كلمة المرور ✅");
      setTimeout(() => router.replace("/auth/login?msg=" + encodeURIComponent("تم تغيير كلمة المرور. سجل دخولك الآن ✅")), 600);
    } catch (e: any) {
      setErr(e?.message || "فشل تغيير كلمة المرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">DR4X</div>
          <div className="text-2xl font-extrabold text-slate-900">تغيير كلمة المرور</div>
        </div>

        <Link
          href="/auth/login"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
        >
          رجوع للدخول
        </Link>
      </div>

      <div className="dr4x-card p-5">
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
          <div className="mb-1 text-xs font-bold text-slate-600">كلمة المرور الجديدة</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <label className="block mb-4">
          <div className="mb-1 text-xs font-bold text-slate-600">تأكيد كلمة المرور</div>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <button
          onClick={onSave}
          disabled={loading}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
        </button>

        <div className="mt-3 text-xs text-slate-500">
          * هذه الصفحة تعمل بعد فتح رابط الاستعادة القادم من البريد.
        </div>
      </div>
    </div>
  );
}
