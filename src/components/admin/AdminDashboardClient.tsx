// src/components/admin/AdminDashboardClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Counts = {
  posts: number;
  doctors: number;
  patients: number;
  consultations: number;
};

export default function AdminDashboardClient() {
  const router = useRouter();

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
          <div className="text-xs text-emerald-300/80">لوحة التحكم</div>
          <h1 className="text-xl font-extrabold tracking-wide text-emerald-200">
            Dashboard
          </h1>
        </div>

        {/* ✅ زر إدارة الإعلان */}
        <button
          type="button"
          onClick={() => router.push("/admin/ads")}
          className={[
            "rounded-xl px-4 py-2 text-sm font-extrabold",
            "bg-emerald-500 text-black hover:bg-emerald-400",
            "shadow-[0_0_0_1px_rgba(16,185,129,0.35)]",
          ].join(" ")}
        >
          إدارة الإعلان
        </button>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-700/60 bg-black p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="عدد التغريدات" value={counts?.posts} />
        <Card title="عدد الأطباء" value={counts?.doctors} />
        <Card title="عدد المرضى" value={counts?.patients} />
        <Card title="عدد الاستشارات" value={counts?.consultations} />
      </div>

      <div className="rounded-2xl border border-emerald-700/50 bg-black p-4">
        <div className="text-sm font-extrabold text-emerald-200 mb-1">
          التالي
        </div>
        <div className="text-sm text-emerald-100/80">
          الآن نبدأ صفحة “المستخدمون” ثم “الأطباء” ثم “الاستشارات” مع بحث/فلترة/إدارة كاملة عبر RPC.
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-emerald-700/40 bg-black p-4">
      <div className="text-sm text-emerald-200/80">{title}</div>
      <div className="mt-2 text-3xl font-extrabold text-emerald-200">
        {value ?? "—"}
      </div>
      <div className="mt-2 h-[2px] w-full bg-emerald-500/30 rounded" />
    </div>
  );
}
