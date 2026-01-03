// src/app/admin/users/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
  is_doctor: boolean | null;
  created_at?: string | null;
  // ✅ حقل الحظر الجديد من جدول profiles
  is_banned: boolean | null;
};

type RoleFilter = "all" | "patients" | "doctors";

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");

  const PAGE_SIZE = 80;
  const [page, setPage] = useState(0);

  // ✅ اختياري: عداد إجمالي (لو RLS تسمح)
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // ✅ لمعرفة أي مستخدم يتم حظره/فك حظره الآن
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const buildBase = () =>
          supabase
            .from("profiles")
            .select(
              "id,username,full_name,email,whatsapp_number,is_doctor,created_at,is_banned",
              { count: "exact" }
            );

        let query = buildBase();

        if (role === "doctors") query = query.eq("is_doctor", true);
        if (role === "patients") query = query.eq("is_doctor", false);

        // محاولة 1: ترتيب بالأحدث
        const attempt1 = await query
          .order("created_at", { ascending: false })
          .range(from, to);

        if (!attempt1.error) {
          if (!alive) return;

          const list = (attempt1.data ?? []) as ProfileRow[];
          setProfiles((prev) => (page === 0 ? list : [...prev, ...list]));
          setTotalCount(
            typeof attempt1.count === "number" ? attempt1.count : null
          );
          setLoading(false);
          return;
        }

        // محاولة 2 (fallback): بدون order(created_at)
        const attempt2Base = buildBase();
        let attempt2 = attempt2Base;

        if (role === "doctors") attempt2 = attempt2.eq("is_doctor", true);
        if (role === "patients") attempt2 = attempt2.eq("is_doctor", false);

        const attempt2Res = await attempt2
          .order("id", { ascending: false })
          .range(from, to);

        if (attempt2Res.error) throw attempt2Res.error;

        if (!alive) return;

        const list2 = (attempt2Res.data ?? []) as ProfileRow[];
        setProfiles((prev) => (page === 0 ? list2 : [...prev, ...list2]));
        setTotalCount(
          typeof attempt2Res.count === "number" ? attempt2Res.count : null
        );
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(
          e?.message ??
            "تعذر جلب المستخدمين من profiles. (غالبًا سياسة RLS تمنع الأدمن من SELECT هنا)."
        );
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [page, role]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return profiles;

    return profiles.filter((p) => {
      const id = (p.id ?? "").toLowerCase();
      const user = (p.username ?? "").toLowerCase();
      const full = (p.full_name ?? "").toLowerCase();
      const email = (p.email ?? "").toLowerCase();
      const wa = (p.whatsapp_number ?? "").toLowerCase();
      const roleTxt = p.is_doctor ? "doctor" : "patient";
      const banTxt = p.is_banned ? "banned" : "active";
      return (
        id.includes(needle) ||
        user.includes(needle) ||
        full.includes(needle) ||
        email.includes(needle) ||
        wa.includes(needle) ||
        roleTxt.includes(needle) ||
        banTxt.includes(needle)
      );
    });
  }, [q, profiles]);

  function onChangeRole(next: RoleFilter) {
    setErr(null);
    setQ("");
    setProfiles([]);
    setPage(0);
    setTotalCount(null);
    setRole(next);
  }

  // ✅ زر الحظر / إلغاء الحظر
  async function toggleBan(p: ProfileRow) {
    if (!p.id) return;
    const next = !p.is_banned;

    const ok = window.confirm(
      next
        ? `هل أنت متأكد من حظر هذا العضو؟\nلن يستطيع النشر أو استخدام النظام حسب ما نطبّقه في الكود.`
        : `هل تريد إلغاء الحظر عن هذا العضو؟`
    );
    if (!ok) return;

    try {
      setErr(null);
      setBusyId(p.id);

      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: next })
        .eq("id", p.id);

      if (error) throw error;

      // تحديث الحالة محليًا
      setProfiles((prev) =>
        prev.map((row) => (row.id === p.id ? { ...row, is_banned: next } : row))
      );
    } catch (e: any) {
      setErr(e?.message ?? "تعذر تحديث حالة الحظر لهذا المستخدم.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Admin</div>
          <h2 className="text-lg font-extrabold">المستخدمون</h2>
          <div className="text-sm text-slate-300">
            عرض المستخدمين من جدول profiles + بحث/فلترة + حظر / إلغاء حظر.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={role}
            onChange={(e) => onChangeRole(e.target.value as RoleFilter)}
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            <option value="all">الكل</option>
            <option value="patients">المرضى</option>
            <option value="doctors">الأطباء</option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث (اسم/يوزر/إيميل/واتساب/ID)…"
            className="w-full sm:w-80 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
          />
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold">قائمة المستخدمين</div>
          <div className="text-xs text-slate-400">
            المعروض: {filtered.length}
            {typeof totalCount === "number" ? ` / الإجمالي: ${totalCount}` : ""}
            {loading ? " • جارٍ التحميل…" : ""}
          </div>
        </div>

        {loading && profiles.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">جارٍ جلب المستخدمين…</div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">لا توجد نتائج.</div>
        ) : null}

        <div className="divide-y divide-slate-800">
          {filtered.map((p) => {
            const banned = !!p.is_banned;
            const isBusy = busyId === p.id;

            return (
              <div key={p.id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-extrabold truncate">
                        {p.full_name?.trim() ? p.full_name : "بدون اسم"}
                      </div>

                      <span
                        className={[
                          "text-xs font-bold rounded-full px-2 py-1 border",
                          p.is_doctor
                            ? "border-sky-900/50 bg-sky-950/40 text-sky-200"
                            : "border-slate-800 bg-slate-950/40 text-slate-200",
                        ].join(" ")}
                      >
                        {p.is_doctor ? "طبيب" : "مريض"}
                      </span>

                      <span
                        className={[
                          "text-xs font-bold rounded-full px-2 py-1 border",
                          banned
                            ? "border-red-900/60 bg-red-950/40 text-red-200"
                            : "border-emerald-900/60 bg-emerald-950/40 text-emerald-200",
                        ].join(" ")}
                      >
                        {banned ? "محظور" : "نشط"}
                      </span>

                      <span className="text-xs text-slate-500 truncate">
                        ID: {p.id}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-500">Username:</span>{" "}
                        <span className="font-semibold">
                          {safeText(p.username)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Email:</span>{" "}
                        <span className="font-semibold">
                          {safeText(p.email)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">WhatsApp:</span>{" "}
                        <span className="font-semibold">
                          {safeText(p.whatsapp_number)}
                        </span>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <span className="text-slate-500">created_at:</span>{" "}
                        <span className="font-semibold">
                          {safeText(p.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                    {/* ✅ زر الحظر / إلغاء الحظر فقط، بدون أي أزرار أخرى */}
                    <button
                      type="button"
                      onClick={() => toggleBan(p)}
                      disabled={isBusy}
                      className={[
                        "rounded-xl px-3 py-2 text-sm font-semibold transition border",
                        banned
                          ? "border-emerald-900 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60"
                          : "border-red-900 bg-red-950/40 text-red-100 hover:bg-red-900/60",
                        isBusy ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      {isBusy
                        ? "جارٍ الحفظ…"
                        : banned
                        ? "إلغاء الحظر"
                        : "حظر المستخدم"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            ملاحظة: زر الحظر يغير حقل <code>is_banned</code> في جدول{" "}
            <code>profiles</code> فقط. تأثير الحظر على النشر أو الدخول يتم من
            الكود في أماكن أخرى.
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-semibold transition",
              loading
                ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                : "border-slate-800 bg-slate-900/40 text-slate-200 hover:bg-slate-900",
            ].join(" ")}
          >
            تحميل المزيد
          </button>
        </div>
      </div>
    </div>
  );
}
