// src/app/admin/library/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import type { LibraryBook, LibraryCategory, LibraryCounts } from "@/components/library/types";
import { fetchCategories, fetchCounts, isCurrentUserAdmin } from "@/components/library/lib";
import { lt, getLibraryLocale } from "@/components/library/i18n";

type Tab = "pending" | "approved" | "rejected";

export default function AdminLibraryPage() {
  const locale = useMemo(() => getLibraryLocale(), []);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [cats, setCats] = useState<LibraryCategory[]>([]);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [selected, setSelected] = useState<LibraryBook | null>(null);
  const [counts, setCounts] = useState<LibraryCounts | null>(null);

  // ملاحظة: في مشروعك البانر غالبًا عبر library_categories.hero_image_path
  // لذلك نخليه اختياري هنا (قد يكون عندك library_settings أو لا)
  const [bannerUrl, setBannerUrl] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const isAdm = await isCurrentUserAdmin();
        if (!mounted) return;
        setAdmin(isAdm);

        const c = await fetchCategories().catch(() => []);
        if (!mounted) return;
        setCats(c);

        // Banner settings (اختياري) - لو عندك جدول library_settings
        // لو ما عندك أو RLS تمنع، نتجاهل بدون تخريب الصفحة
        try {
          const { data: settings } = await supabase
            .from("library_settings")
            .select("banner_url")
            .eq("id", 1)
            .maybeSingle();
          if (mounted) setBannerUrl(settings?.banner_url ?? "");
        } catch {
          // ignore
        }

        if (isAdm) {
          await loadBooks("pending");
        } else {
          if (mounted) setLoading(false);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Error");
        setLoading(false);
        setAdmin(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBooks(t: Tab) {
    setLoading(true);
    setErr(null);
    setMsg(null);
    setSelected(null);
    setCounts(null);

    try {
      const { data, error } = await supabase
        .from("library_books")
        .select(
          // ✅ أسماء الأعمدة كما في صورك
          "id,category_id,title,author_name,description,toc,cover_path,preview_file_path,full_file_path,preview_enabled,is_paid,price,currency,status,review_reason,submitted_by_user_id,approved_by_user_id,approved_at,created_at,shelf"
        )
        .eq("status", t)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setBooks((data ?? []) as LibraryBook[]);
      setTab(t);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  async function openBook(b: LibraryBook) {
    setSelected(b);
    try {
      const c = await fetchCounts((b as any).id);
      setCounts(c);
    } catch {
      setCounts(null);
    }
  }

  async function saveBook(updated: Partial<LibraryBook>) {
    if (!selected) return;

    setErr(null);
    setMsg(null);

    const payload: any = {
      title: (updated as any).title ?? (selected as any).title,
      author_name: (updated as any).author_name ?? (selected as any).author_name,
      description: (updated as any).description ?? (selected as any).description,
      toc: (updated as any).toc ?? (selected as any).toc,
      category_id: (updated as any).category_id ?? (selected as any).category_id,
      preview_enabled: (updated as any).preview_enabled ?? (selected as any).preview_enabled,
      is_paid: (updated as any).is_paid ?? (selected as any).is_paid,
      price: (updated as any).price ?? (selected as any).price,
      currency: (updated as any).currency ?? (selected as any).currency,
      shelf: (updated as any).shelf ?? (selected as any).shelf,
    };

    const { error } = await supabase
      .from("library_books")
      .update(payload)
      .eq("id", (selected as any).id);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg(lt("save", locale));
    await loadBooks(tab);
  }

  async function approveBook() {
    if (!selected) return;
    setErr(null);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;

    const { error } = await supabase
      .from("library_books")
      .update({
        status: "approved",
        review_reason: null,
        approved_by_user_id: uid,
        approved_at: new Date().toISOString(),
      })
      .eq("id", (selected as any).id);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg(lt("approved", locale));
    await loadBooks(tab);
  }

  async function rejectBook(reason: string) {
    if (!selected) return;
    setErr(null);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;

    const { error } = await supabase
      .from("library_books")
      .update({
        status: "rejected",
        review_reason: reason?.trim() ? reason.trim() : "—",
        approved_by_user_id: uid,
        approved_at: new Date().toISOString(),
      })
      .eq("id", (selected as any).id);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg(lt("rejected", locale));
    await loadBooks(tab);
  }

  async function updateBanner() {
    setErr(null);
    setMsg(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;

      const { error } = await supabase
        .from("library_settings")
        .update({
          banner_url: bannerUrl.trim() || null,
          updated_by: uid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) {
        setErr(error.message);
        return;
      }
      setMsg(lt("updateBanner", locale));
    } catch (e: any) {
      // إذا ما عندك library_settings أو RLS تمنع
      setErr(e?.message ?? "Error");
    }
  }

  if (admin === false) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          {lt("notAdmin", locale)}
        </div>
      </div>
    );
  }

  if (admin === null) {
    return <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-white/60">…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">{lt("adminLibrary", locale)}</h1>
      </div>

      {/* Banner (اختياري) */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 text-sm font-semibold text-white/90">{lt("banner", locale)}</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          />
          <button
            onClick={updateBanner}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            {lt("updateBanner", locale)}
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(["pending", "approved", "rejected"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => loadBooks(t)}
            className={`rounded-xl border px-3 py-2 text-sm ${
              tab === t
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
            }`}
          >
            {lt(t, locale)}
          </button>
        ))}
      </div>

      {err ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {msg ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {msg}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-semibold text-white/90">
            {lt("status", locale)}: {lt(tab, locale)}
          </div>

          {loading ? (
            <div className="text-sm text-white/60">…</div>
          ) : (books as any[]).length ? (
            <div className="grid gap-2">
              {(books as any[]).map((b) => (
                <button
                  key={b.id}
                  onClick={() => openBook(b)}
                  className={`text-left rounded-xl border px-3 py-2 ${
                    (selected as any)?.id === b.id
                      ? "border-white/20 bg-white/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="text-sm font-semibold text-white/90">{b.title}</div>
                  <div className="text-xs text-white/70">{b.author_name ?? "—"}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/60">—</div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {!selected ? (
            <div className="text-sm text-white/60">—</div>
          ) : (
            <AdminEditor
              locale={locale}
              cats={cats}
              book={selected}
              counts={counts}
              onSave={saveBook}
              onApprove={approveBook}
              onReject={rejectBook}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AdminEditor({
  locale,
  cats,
  book,
  counts,
  onSave,
  onApprove,
  onReject,
}: {
  locale: "ar" | "en" | "tr";
  cats: LibraryCategory[];
  book: LibraryBook;
  counts: LibraryCounts | null;
  onSave: (u: Partial<LibraryBook>) => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}) {
  const [title, setTitle] = useState((book as any).title);
  const [author, setAuthor] = useState((book as any).author_name ?? "");
  const [description, setDescription] = useState((book as any).description ?? "");
  const [toc, setToc] = useState((book as any).toc ?? "");
  const [categoryId, setCategoryId] = useState<string>(String((book as any).category_id ?? ""));

  const [previewEnabled, setPreviewEnabled] = useState(!!(book as any).preview_enabled);
  const [isPaid, setIsPaid] = useState(!!(book as any).is_paid);
  const [price, setPrice] = useState((book as any).price?.toString?.() ?? "");
  const [currency, setCurrency] = useState((book as any).currency ?? "SAR");
  const [shelf, setShelf] = useState((book as any).shelf ?? "scientific");

  const [reviewReason, setReviewReason] = useState((book as any).review_reason ?? "");

  useEffect(() => {
    setTitle((book as any).title);
    setAuthor((book as any).author_name ?? "");
    setDescription((book as any).description ?? "");
    setToc((book as any).toc ?? "");
    setCategoryId(String((book as any).category_id ?? ""));
    setPreviewEnabled(!!(book as any).preview_enabled);
    setIsPaid(!!(book as any).is_paid);
    setPrice((book as any).price?.toString?.() ?? "");
    setCurrency((book as any).currency ?? "SAR");
    setShelf((book as any).shelf ?? "scientific");
    setReviewReason((book as any).review_reason ?? "");
  }, [book]);

  const previewViews = (counts as any)?.view_preview_count ?? 0;
  const downloadClicks = (counts as any)?.download_click_count ?? 0;
  const downloadSuccess = (counts as any)?.download_success_count ?? 0;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3 text-sm text-white/80">
        <div>
          {lt("previewViews", locale)}: <span className="text-white/95">{previewViews}</span>
        </div>
        <div>
          {lt("downloads", locale)}: <span className="text-white/95">{downloadClicks}</span>
        </div>
        <div>
          نجاح: <span className="text-white/95">{downloadSuccess}</span>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-white/80">{lt("title", locale)}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-white/80">{lt("author", locale)}</label>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-white/80">{lt("category", locale)}</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
        >
          {cats.map((c: any) => (
            <option key={String(c.id)} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-white/80">Shelf</label>
        <select
          value={shelf}
          onChange={(e) => setShelf(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="scientific">scientific</option>
          <option value="prophetic">prophetic</option>
          <option value="folk">folk</option>
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-white/80">{lt("description", locale)}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-white/80">{lt("toc", locale)}</label>
        <textarea
          value={toc}
          onChange={(e) => setToc(e.target.value)}
          rows={3}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={previewEnabled} onChange={(e) => setPreviewEnabled(e.target.checked)} />
          preview_enabled
        </label>

        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
          {lt("paid", locale)}
        </label>
      </div>

      {isPaid ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm text-white/80">{lt("price", locale)}</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-white/80">{lt("currency", locale)}</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            onSave({
              title,
              author_name: author.trim() ? author.trim() : null,
              description: description.trim() ? description.trim() : null,
              toc: toc.trim() ? toc.trim() : null,
              category_id: categoryId,
              preview_enabled: previewEnabled,
              is_paid: isPaid,
              price: isPaid && price ? Number(price) : null,
              currency: isPaid ? (currency?.trim() || null) : null,
              shelf,
            } as any)
          }
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
        >
          {lt("save", locale)}
        </button>

        <button
          onClick={onApprove}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
        >
          {lt("approve", locale)}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="mb-2 text-sm font-semibold text-white/90">{lt("reject", locale)}</div>
        <textarea
          value={reviewReason}
          onChange={(e) => setReviewReason(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
        />
        <button
          onClick={() => onReject(reviewReason)}
          className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
        >
          {lt("reject", locale)}
        </button>
      </div>
    </div>
  );
}
