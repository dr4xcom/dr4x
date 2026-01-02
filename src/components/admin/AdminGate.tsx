// src/components/admin/AdminGate.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setChecking(true);
        setErr(null);

        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const user = data?.user;
        if (!user) {
          router.replace("/auth/login");
          return;
        }

        const { data: adminOk, error: adminErr } = await supabase.rpc("is_admin", {
          p_uid: user.id,
        });

        if (adminErr) throw adminErr;

        if (!adminOk) {
          router.replace("/home");
          return;
        }

        if (!alive) return;
        setChecking(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Admin gate error");
        setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="text-sm text-slate-300">جارٍ التحقق من صلاحيات الأدمن…</div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-red-900/50 bg-red-950/40 p-5">
          <div className="text-sm font-semibold text-red-200 mb-1">خطأ</div>
          <div className="text-sm text-red-200/90">{err}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
