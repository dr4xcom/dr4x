// src/app/auth/confirm/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ConfirmPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("جارٍ تأكيد الدخول/الاسترجاع…");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Supabase يرسل code في الرابط
        const url = typeof window !== "undefined" ? window.location.href : "";
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) throw error;

        setMsg("تم ✅ يمكنك الآن المتابعة.");
        router.push("/home");
      } catch (e: any) {
        setErr(e?.message || "فشل التأكيد");
      }
    })();
  }, [router]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="dr4x-card p-4">
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        ) : (
          <div className="text-sm text-slate-700">{msg}</div>
        )}

        <div className="mt-3 text-xs text-slate-600">
          <Link className="underline" href="/auth/login">الدخول</Link> ·{" "}
          <Link className="underline" href="/auth/register">تسجيل جديد</Link>
        </div>
      </div>
    </div>
  );
}
