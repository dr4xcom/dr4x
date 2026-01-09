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
  avatar_path?: string | null;
  is_banned?: boolean | null;
  badge?: string | null; // ✅ نخزن نص
};

type RoleFilter = "all" | "patients" | "doctors";

// ✅ قيم الشارات المعتمدة (حسب طلبك)
type BadgeValue =
  | ""
  | "verified"
  | "star1"
  | "star2"
  | "star3"
  | "star1_verified"
  | "star2_verified"
  | "star3_verified";

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

async function callAdminApi(path: string, payload: any) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new Error("يرجى تسجيل الدخول من جديد (session مفقودة).");
  }

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  return json;
}

function badgeLabel(v: string | null | undefined) {
  const b = (v ?? "").trim();
  if (!b) return "بدون شارة";
  if (b === "verified") return "شارة تويتر ✔";
  if (b === "star1") return "نجمة ⭐";
  if (b === "star2") return "نجمتين ⭐⭐";
  if (b === "star3") return "ثلاث نجمات ⭐⭐⭐";
  if (b === "star1_verified") return "نجمة ⭐ + تويتر ✔";
  if (b === "star2_verified") return "⭐⭐ + تويتر ✔";
  if (b === "star3_verified") return "⭐⭐⭐ + تويتر ✔";

  // توافق خلفي لو عندك قيم قديمة
  if (b === "vip") return "نجمة ⭐";
  if (b === "vip_verified") return "نجمة ⭐ + تويتر ✔";

  return b;
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");

  const PAGE_SIZE = 80;
  const [page, setPage] = useState(0);

  const [actionBusy, setActionBusy] = useState(false);

  const [totalCount, setTotalCount] = useState<number | null>(null);

  const [moderatorsMap, setModeratorsMap] = useState<Record<string, boolean>>(
    {}
  );

  /* =========================================
     1) تحميل قائمة المشرفين
     ========================================= */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res: any = await callAdminApi(
          "/api/admin/users/moderators-list",
          {}
        );

        if (!alive) return;

        const map: Record<string, boolean> = {};
        (res.uids ?? []).forEach((uid: string) => {
          if (uid) map[String(uid)] = true;
        });

        setModeratorsMap(map);
      } catch (e) {
        console.error("Failed to load moderators list:", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* =========================================
     2) تحميل المستخدمين من profiles
     ========================================= */
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
              "id,username,full_name,email,whatsapp_number,is_doctor,created_at,avatar_path,is_banned,badge",
              { count: "exact" }
            );

        let query = buildBase();

        if (role === "doctors") query = query.eq("is_doctor", true);
        if (role === "patients") query = query.eq("is_doctor", false);

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
      return (
        id.includes(needle) ||
        user.includes(needle) ||
        full.includes(needle) ||
        email.includes(needle) ||
        wa.includes(needle) ||
        roleTxt.includes(needle)
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

  async function handleDelete(uid: string) {
    if (!uid) return alert("لم يتم التعرف على رقم المستخدم (uid).");

    const ok = window.confirm(
      "هل أنت متأكد أنك تريد حذف هذا المستخدم نهائيًا من قاعدة البيانات و Supabase Auth؟ هذا الإجراء لا يمكن التراجع عنه."
    );
    if (!ok) return;

    try {
      setActionBusy(true);
      await callAdminApi("/api/admin/users/delete", { uid });
      setProfiles((prev) => prev.filter((p) => p.id !== uid));
      setModeratorsMap((prev) => {
        const copy = { ...prev };
        delete copy[uid];
        return copy;
      });
      alert("تم حذف المستخدم نهائيًا.");
    } catch (e: any) {
      alert("فشل حذف المستخدم: " + (e?.message || ""));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleToggleBan(uid: string, current: boolean | null) {
    const banned = !current;
    const ok = window.confirm(
      banned ? "هل تريد حظر هذا المستخدم؟" : "هل تريد إلغاء الحظر عن هذا المستخدم؟"
    );
    if (!ok) return;

    try {
      setActionBusy(true);
      await callAdminApi("/api/admin/users/ban", { uid, banned });
      setProfiles((prev) =>
        prev.map((p) => (p.id === uid ? { ...p, is_banned: banned } : p))
      );
      alert(banned ? "تم حظر المستخدم." : "تم إلغاء الحظر عن المستخدم.");
    } catch (e: any) {
      alert("فشل تغيير حالة الحظر: " + (e?.message || ""));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleToggleModerator(uid: string) {
    if (!uid) return;

    const currentlyModerator = !!moderatorsMap[uid];
    const makeModerator = !currentlyModerator;

    const ok = window.confirm(
      makeModerator
        ? "هل تريد تعيين هذا المستخدم كمشرف؟ سيتمكن من حذف/إدارة التغريدات."
        : "هل تريد إلغاء الإشراف عن هذا المستخدم؟"
    );
    if (!ok) return;

    try {
      setActionBusy(true);
      await callAdminApi("/api/admin/users/moderator", {
        uid,
        moderator: makeModerator,
      });

      setModeratorsMap((prev) => ({
        ...prev,
        [uid]: makeModerator,
      }));

      alert(makeModerator ? "تم تعيين المستخدم مشرفًا." : "تم إلغاء الإشراف.");
    } catch (e: any) {
      alert("فشل تغيير حالة الإشراف: " + (e?.message || ""));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleChangeBadge(uid: string, badge: BadgeValue) {
    const badgeValue = badge === "" ? null : badge;

    const label = badgeLabel(badgeValue);

    const ok = window.confirm(`هل تريد تعيين: ${label} ؟`);
    if (!ok) return;

    try {
      setActionBusy(true);
      await callAdminApi("/api/admin/users/badge", {
        uid,
        badge: badgeValue,
      });

      setProfiles((prev) =>
        prev.map((p) => (p.id === uid ? { ...p, badge: badgeValue } : p))
      );

      alert(`تم تعيين: ${label}`);
    } catch (e: any) {
      alert("فشل تغيير الشارة: " + (e?.message || ""));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Admin</div>
          <h2 className="text-lg font-extrabold">المستخدمون</h2>
          <div className="text-sm text-slate-300">
            عرض المستخدمين من جدول profiles + بحث/فلترة (مع حذف/حظر وتعيين مشرفين
            وشارات).
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
            {actionBusy ? " • جارٍ تنفيذ أمر إداري…" : ""}
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
            const isModerator = !!moderatorsMap[p.id];

            const badgeValue = ((p.badge ?? "") as BadgeValue) || "";

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

                      {isModerator ? (
                        <span className="text-xs font-bold rounded-full px-2 py-1 border border-emerald-900/60 bg-emerald-950/40 text-emerald-200">
                          مشرف
                        </span>
                      ) : null}

                      {badgeValue ? (
                        <span className="text-xs font-bold rounded-full px-2 py-1 border border-slate-700 bg-slate-900/40 text-slate-100">
                          {badgeLabel(badgeValue)}
                        </span>
                      ) : null}

                      {banned ? (
                        <span className="text-xs font-bold rounded-full px-2 py-1 border border-red-900/60 bg-red-950/40 text-red-200">
                          محظور
                        </span>
                      ) : null}

                      <span className="text-xs text-slate-500 truncate">
                        ID: {p.id}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-500">Username:</span>{" "}
                        <span className="font-semibold">{safeText(p.username)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Email:</span>{" "}
                        <span className="font-semibold">{safeText(p.email)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">WhatsApp:</span>{" "}
                        <span className="font-semibold">
                          {safeText(p.whatsapp_number)}
                        </span>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <span className="text-slate-500">created_at:</span>{" "}
                        <span className="font-semibold">{safeText(p.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                    {/* ✅ تعيين الشارة */}
                    <select
                      value={badgeValue}
                      onChange={(e) => handleChangeBadge(p.id, e.target.value as BadgeValue)}
                      disabled={actionBusy}
                      className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
                    >
                      <option value="">بدون شارة</option>
                      <option value="verified">شارة تويتر ✔</option>
                      <option value="star1">نجمة ⭐</option>
                      <option value="star2">نجمتين ⭐⭐</option>
                      <option value="star3">ثلاث نجمات ⭐⭐⭐</option>
                      <option value="star1_verified">نجمة ⭐ + تويتر ✔</option>
                      <option value="star2_verified">⭐⭐ + تويتر ✔</option>
                      <option value="star3_verified">⭐⭐⭐ + تويتر ✔</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={actionBusy}
                      className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/40 disabled:opacity-60"
                    >
                      حذف نهائي
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleBan(p.id, p.is_banned ?? false)}
                      disabled={actionBusy}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                        banned
                          ? "border-emerald-900 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40"
                          : "border-yellow-900 bg-yellow-950/40 text-yellow-100 hover:bg-yellow-900/40"
                      }`}
                    >
                      {banned ? "إلغاء الحظر" : "حظر"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleModerator(p.id)}
                      disabled={actionBusy}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                        isModerator
                          ? "border-emerald-900 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40"
                          : "border-sky-900 bg-sky-950/40 text-sky-100 hover:bg-sky-900/40"
                      }`}
                    >
                      {isModerator ? "إلغاء الإشراف" : "تعيين مشرف"}
                    </button>

                    <button
                      type="button"
                      disabled
                      className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed"
                    >
                      صورة (قريبًا)
                    </button>

                    <button
                      type="button"
                      disabled
                      className="rounded-xl border border-slate-900 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-600 cursor-not-allowed"
                      title="لاحقًا: تعديل البيانات عبر RPC (إذا RLS تمنع UPDATE من العميل)"
                    >
                      تعديل (قريبًا)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            ملاحظة: هذه الصفحة للعرض + أوامر الإدارة (حذف / حظر / تعيين مشرف / شارات).
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
