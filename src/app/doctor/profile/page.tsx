"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  is_doctor: boolean | null;
  whatsapp_number: string | null;
  email: string | null;
  created_at: string | null;
};

type DoctorRow = {
  profile_id: string;
  specialty_id: number | null;
  rank_id: number | null;
  is_approved: boolean | null;
};

function v(s?: string | null) {
  const t = (s ?? "").trim();
  return t || "—";
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export default function DoctorProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [doctor, setDoctor] = useState<DoctorRow | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        // 1) تأكيد تسجيل الدخول
        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;

        const uid = uRes?.user?.id ?? null;
        if (!uid) {
          router.replace("/auth/login");
          return;
        }

        // 2) قراءة البروفايل
        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("id,username,full_name,is_doctor,whatsapp_number,email,created_at")
          .eq("id", uid)
          .maybeSingle();

        if (pErr) throw pErr;
        if (!pData || pData.is_doctor !== true) {
          router.replace("/home");
          return;
        }

        if (!alive) return;
        setProfile(pData as ProfileRow);

        // 3) قراءة بيانات الطبيب
        const { data: dData, error: dErr } = await supabase
          .from("doctors")
          .select("profile_id,specialty_id,rank_id,is_approved")
          .eq("profile_id", uid)
          .maybeSingle();

        if (dErr) throw dErr;
        if (!alive) return;
        setDoctor((dData ?? null) as DoctorRow | null);

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر تحميل ملف الطبيب.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const titleName = useMemo(() => {
    const full = (profile?.full_name ?? "").trim();
    const user = (profile?.username ?? "").trim();
    return full || (user ? `@${user}` : "ملف الطبيب");
  }, [profile]);

  if (loading) {
    return <div className="p-6">جاري التحميل…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">{titleName}</h1>
          <div className="mt-2 text-sm text-slate-600">
            صفحة ملف الطبيب (قراءة فقط)
          </div>
        </div>

        <button
          onClick={() => router.push("/home")}
          className="rounded-xl px-4 py-2 border border-slate-200 hover:bg-slate-50"
        >
          الرجوع
        </button>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {err}
        </div>
      ) : null}

      {/* بطاقة الحساب */}
      <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="text-lg font-semibold">بيانات الحساب</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-slate-500">الاسم</div>
            <div className="font-semibold">{v(profile?.full_name)}</div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-slate-500">اسم المستخدم</div>
            <div className="font-semibold">
              {profile?.username ? `@${profile.username}` : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-slate-500">البريد</div>
            <div className="font-semibold">{v(profile?.email)}</div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-slate-500">واتساب</div>
            <div className="font-semibold">{v(profile?.whatsapp_number)}</div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
            <div className="text-xs text-slate-500">تاريخ إنشاء الحساب</div>
            <div className="font-semibold">{fmtDateTime(profile?.created_at)}</div>
          </div>
        </div>
      </div>

      {/* بطاقة بيانات الطبيب */}
      <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="text-lg font-semibold">بيانات الطبيب</div>

        {!doctor ? (
          <div className="text-sm text-amber-700">
            لا يوجد سجل في جدول <span className="font-mono">doctors</span>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">معتمد</div>
              <div className="font-semibold">
                {doctor.is_approved ? "نعم" : "لا"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Specialty ID</div>
              <div className="font-mono text-xs">
                {doctor.specialty_id ?? "—"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Rank ID</div>
              <div className="font-mono text-xs">
                {doctor.rank_id ?? "—"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        * i18n: استبدل النصوص بمفاتيح الترجمة حسب نظام تعدد اللغات.
      </div>
    </div>
  );
}
