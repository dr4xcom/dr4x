"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function Page() {
  const [status, setStatus] = useState("جاري الفحص...");

  useEffect(() => {
    async function check() {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setStatus("❌ خطأ في الاتصال: " + error.message);
      } else {
        setStatus(
          data.session
            ? "✅ Supabase متصل (فيه جلسة مستخدم)"
            : "✅ Supabase متصل (لا توجد جلسة)"
        );
      }
    }
    check();
  }, []);

  return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="rounded-2xl border bg-white p-6 text-center">
        <h1 className="text-xl font-bold">DR4X</h1>
        <p className="mt-2 text-slate-700">{status}</p>
      </div>
    </main>
  );
}
