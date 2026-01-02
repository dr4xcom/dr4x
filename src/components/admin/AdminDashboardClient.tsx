// src/components/admin/AdminDashboardClient.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Counts = {
  posts: number;
  doctors: number;
  patients: number;
  consultations: number;
};

export default function AdminDashboardClient() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);

        const { data, error } = await supabase.rpc("admin_dashboard_counts");
        if (error) throw error;

        const next: Counts = {
          posts: Number(data?.posts ?? 0),
          doctors: Number(data?.doctors ?? 0),
          patients: Number(data?.patients ?? 0),
          consultations: Number(data?.consultations ?? 0),
        };

        if (!alive) return;
        setCounts(next);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Dashboard error");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">لوحة التحكم</div>
          <h1 className="text-xl font-extrabold tracking-wide">Dashboard</h1>
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="عدد التغريدات" value={counts?.posts} />
        <Card title="عدد الأطباء" value={counts?.doctors} />
        <Card title="عدد المرضى" value={counts?.patients} />
        <Card title="عدد الاستشارات" value={counts?.consultations} />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="text-sm font-semibold mb-1">التالي</div>
        <div className="text-sm text-slate-300">
          الآن نبدأ صفحة “المستخدمون” ثم “الأطباء” ثم “الاستشارات” مع بحث/فلترة/إدارة كاملة عبر RPC.
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-2 text-3xl font-extrabold text-slate-100">{value ?? "—"}</div>
    </div>
  );
}
