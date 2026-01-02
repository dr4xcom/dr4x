// src/app/admin/posts/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type PostRow = {
  id: string | number;
  author_id?: string | null;
  content?: string | null;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

export default function AdminPostsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileRow>>({});

  const [q, setQ] = useState("");

  const PAGE_SIZE = 60;
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // ✅ مطابق لجدول posts عندك: author_id + content + created_at
        const { data, error } = await supabase
          .from("posts")
          .select("id,author_id,content,created_at")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const list = (data ?? []) as PostRow[];
        if (!alive) return;

        setPosts((prev) => (page === 0 ? list : [...prev, ...list]));

        // جلب profiles لأصحاب التغريدات
        const ids = Array.from(new Set(list.map((p) => p.author_id).filter(Boolean) as string[]));
        if (ids.length) {
          const { data: profs, error: profErr } = await supabase
            .from("profiles")
            .select("id,username,full_name,email")
            .in("id", ids);

          if (profErr) throw profErr;

          const map: Record<string, ProfileRow> = {};
          (profs ?? []).forEach((p: any) => {
            if (p?.id) map[p.id] = p as ProfileRow;
          });

          if (!alive) return;
          setProfilesMap((prev) => ({ ...prev, ...map }));
        }

        if (!alive) return;
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر جلب التغريدات.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [page]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return posts;

    return posts.filter((p) => {
      const id = String(p.id ?? "").toLowerCase();
      const content = String(p.content ?? "").toLowerCase();
      const uid = String(p.author_id ?? "").toLowerCase();

      const prof = p.author_id ? profilesMap[p.author_id] : null;
      const full = (prof?.full_name ?? "").toLowerCase();
      const user = (prof?.username ?? "").toLowerCase();
      const email = (prof?.email ?? "").toLowerCase();

      return (
        id.includes(needle) ||
        uid.includes(needle) ||
        content.includes(needle) ||
        full.includes(needle) ||
        user.includes(needle) ||
        email.includes(needle)
      );
    });
  }, [q, posts, profilesMap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Admin</div>
          <h2 className="text-lg font-extrabold">التغريدات</h2>
          <div className="text-sm text-slate-300">
            مراجعة التغريدات + بحث (بدون حذف/إخفاء الآن) — بدون تعديل DB/RLS.
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث (محتوى/ID/يوزر/إيميل/UID)…"
          className="w-full sm:w-80 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
        />
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold">قائمة التغريدات</div>
          <div className="text-xs text-slate-400">
            المعروض: {filtered.length} {loading ? "• جارٍ التحميل…" : ""}
          </div>
        </div>

        {loading && posts.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">جارٍ جلب التغريدات…</div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">لا توجد تغريدات.</div>
        ) : null}

        <div className="divide-y divide-slate-800">
          {filtered.map((p) => {
            const prof = p.author_id ? profilesMap[p.author_id] : null;

            return (
              <div key={String(p.id)} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-extrabold">Post #{String(p.id)}</div>
                      <span className="text-xs text-slate-500 truncate">
                        by: {safeText(p.author_id)}
                      </span>
                      <span className="text-xs text-slate-500">
                        created_at: {safeText(p.created_at)}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-500">الاسم:</span>{" "}
                        <span className="font-semibold">{safeText(prof?.full_name)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Username:</span>{" "}
                        <span className="font-semibold">{safeText(prof?.username)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Email:</span>{" "}
                        <span className="font-semibold">{safeText(prof?.email)}</span>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-xs text-slate-400 mb-1">المحتوى</div>
                      <div className="text-sm text-slate-100 whitespace-pre-wrap break-words">
                        {safeText(p.content)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                    <button
                      type="button"
                      disabled
                      className="rounded-xl border border-slate-900 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-600 cursor-not-allowed"
                      title="لاحقًا: إخفاء/حذف — قد يحتاج RPC حسب RLS"
                    >
                      إجراءات (قريبًا)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            ملاحظة: لم نفعل الحذف/الإخفاء الآن لتجنب كسر RLS.
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
