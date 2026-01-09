"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Counts = {
  posts: number;
  doctors: number;
  patients: number;
  consultations: number;
};

export default function AdminPageClient() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const [counts, setCounts] = useState<Counts | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setChecking(true);
        setErr(null);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;

        if (!user) {
          router.replace("/auth/login");
          return;
        }

        if (!mounted) return;
        setEmail(user.email ?? null);

        // ✅ تحقق الأدمن عبر RPC
        const { data: adminOk, error: adminErr } = await supabase.rpc("is_admin", {
          p_uid: user.id,
        });

        if (adminErr) throw adminErr;

        const ok = !!adminOk;
        if (!mounted) return;

        setIsAdmin(ok);

        if (!ok) {
          router.replace("/home");
          return;
        }

        // ✅ اجلب الإحصائيات من RPC (يتجاوز RLS بأمان)
        const { data: countsJson, error: countsErr } = await supabase.rpc(
          "admin_dashboard_counts"
        );

        if (countsErr) throw countsErr;

        const nextCounts: Counts = {
          posts: Number(countsJson?.posts ?? 0),
          doctors: Number(countsJson?.doctors ?? 0),
          patients: Number(countsJson?.patients ?? 0),
          consultations: Number(countsJson?.consultations ?? 0),
        };

        if (!mounted) return;
        setCounts(nextCounts);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Error");
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="dr4x-card p-4 text-sm text-slate-500">جارٍ التحقق…</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="DR4X"
            className="h-10 w-10 rounded-full border border-slate-200 bg-white object-cover"
          />
          <div>
            <div className="text-sm text-slate-500">لوحة تحكم DR4X</div>
            <div className="text-lg font-extrabold text-slate-900">Admin</div>
          </div>
        </div>

        <Link
          href="/home"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          رجوع للرئيسية ➜
        </Link>
      </div>

      {err ? (
        <div className="dr4x-card p-4 border border-red-200 bg-red-50 text-sm text-red-700 mb-4">
          {err}
        </div>
      ) : null}

      <div className="dr4x-card p-4 mb-4">
        <div className="text-sm text-slate-600">الحساب:</div>
        <div className="font-semibold text-slate-900">{email ?? "—"}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="dr4x-card p-4">
          <div className="text-sm text-slate-600">عدد التغريدات</div>
          <div className="text-2xl font-extrabold text-slate-900">
            {counts?.posts ?? "—"}
          </div>
        </div>

        <div className="dr4x-card p-4">
          <div className="text-sm text-slate-600">عدد الأطباء</div>
          <div className="text-2xl font-extrabold text-slate-900">
            {counts?.doctors ?? "—"}
          </div>
        </div>

        <div className="dr4x-card p-4">
          <div className="text-sm text-slate-600">عدد المرضى</div>
          <div className="text-2xl font-extrabold text-slate-900">
            {counts?.patients ?? "—"}
          </div>
        </div>

        <div className="dr4x-card p-4">
          <div className="text-sm text-slate-600">عدد الاستشارات</div>
          <div className="text-2xl font-extrabold text-slate-900">
            {counts?.consultations ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
