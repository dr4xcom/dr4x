"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import type { LibraryCategory } from "@/components/library/types";
import { fetchCategories } from "@/components/library/lib";
import LibraryHeader from "@/components/library/LibraryHeader";

function safeName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-\.]+/g, "")
    .slice(0, 120);
}

export default function LibrarySubmitPage() {
  const [cats, setCats] = useState<LibraryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [description, setDescription] = useState("");
  const [toc, setToc] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");

  const [shelf, setShelf] = useState<"scientific" | "prophetic" | "folk">(
    "scientific"
  );

  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<string>("");
  const [currency, setCurrency] = useState<string>("SAR");

  const [cover, setCover] = useState<File | null>(null);
  const [previewPdf, setPreviewPdf] = useState<File | null>(null);
  const [fullPdf, setFullPdf] = useState<File | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const c = await fetchCategories();
        if (mounted) {
          setCats(c);
          setCategoryId(c[0]?.id ?? "");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function requireUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  }

  // ✅ تأكيد: اسم الباكت عندك "clinic" (حروف صغيرة)
  const BUCKET = "clinic";

  async function uploadToBucket(path: string, file: File) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setDone(null);

    try {
      const user = await requireUser();
      if (!user) {
        setErr("يلزم تسجيل الدخول");
        return;
      }

      if (!title.trim()) throw new Error("العنوان مطلوب");
      if (!categoryId) throw new Error("اختر القسم");
      if (!cover) throw new Error("الغلاف مطلوب");
      if (!fullPdf) throw new Error("PDF الكامل مطلوب");

      const bookId = crypto.randomUUID();

      // ✅ مسارات منظمة داخل clinic + UUID كمجلد مستقل (لتجنب مشاكل سياسات uuid)
      const coverPath = `library/covers/${bookId}/${safeName(cover.name)}`;
      const previewPath = previewPdf
        ? `library/previews/${bookId}/${safeName(previewPdf.name)}`
        : null;
      const fullPath = `library/full/${bookId}/${safeName(fullPdf.name)}`;

      // Upload files first
      await uploadToBucket(coverPath, cover);
      if (previewPdf && previewPath) await uploadToBucket(previewPath, previewPdf);
      await uploadToBucket(fullPath, fullPdf);

      // Insert row (pending)
      const { error: insErr } = await supabase.from("library_books").insert({
        id: bookId,
        title: title.trim(),
        author_name: authorName.trim() ? authorName.trim() : null,
        description: description.trim() ? description.trim() : null,
        toc: toc.trim() ? toc.trim() : null,

        category_id: categoryId,

        cover_path: coverPath,
        preview_file_path: previewPath,
        full_file_path: fullPath,

        preview_enabled: !!previewPdf,

        is_paid: isPaid,
        price: isPaid && price ? Number(price) : null,
        currency: isPaid ? (currency?.trim() || null) : null,

        shelf,

        status: "pending",
        review_reason: null,

        submitted_by_user_id: user.id,
      });

      if (insErr) throw insErr;

      setDone("تم الإرسال وسيظهر بعد موافقة الإدارة.");
      setTitle("");
      setAuthorName("");
      setDescription("");
      setToc("");
      setShelf("scientific");
      setIsPaid(false);
      setPrice("");
      setCurrency("SAR");
      setCover(null);
      setPreviewPdf(null);
      setFullPdf(null);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-200";
  const labelCls = "text-sm font-semibold text-slate-800";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <LibraryHeader
        title="رفع كتاب"
        subtitle="المكتبة الطبية"
        rightActionHref="/library"
        rightActionLabel="رجوع"
      />

      <div className="dr4x-card p-4">
        {loading ? (
          <div className="text-sm text-slate-500">…</div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            {err ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {err}
              </div>
            ) : null}
            {done ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {done}
              </div>
            ) : null}

            <div className="grid gap-2">
              <label className={labelCls}>العنوان</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="grid gap-2">
              <label className={labelCls}>المؤلف (اختياري)</label>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="grid gap-2">
              <label className={labelCls}>القسم</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className={labelCls}>الرف</label>
              <select
                value={shelf}
                onChange={(e) => setShelf(e.target.value as any)}
                className={inputCls}
              >
                <option value="scientific">كتب علمية</option>
                <option value="prophetic">طب نبوي</option>
                <option value="folk">طب شعبي</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className={labelCls}>الوصف</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={inputCls}
              />
            </div>

            <div className="grid gap-2">
              <label className={labelCls}>الفهرس (اختياري)</label>
              <textarea
                value={toc}
                onChange={(e) => setToc(e.target.value)}
                rows={4}
                className={inputCls}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                />
                مدفوع؟
              </label>
            </div>

            {isPaid ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className={labelCls}>السعر</label>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    inputMode="decimal"
                    className={inputCls}
                  />
                </div>
                <div className="grid gap-2">
                  <label className={labelCls}>العملة</label>
                  <input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <label className={labelCls}>الغلاف</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                className="text-sm text-slate-700"
              />
            </div>

            <div className="grid gap-2">
              <label className={labelCls}>PDF المعاينة (اختياري)</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPreviewPdf(e.target.files?.[0] ?? null)}
                className="text-sm text-slate-700"
              />
            </div>

            <div className="grid gap-2">
              <label className={labelCls}>PDF الكامل</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFullPdf(e.target.files?.[0] ?? null)}
                className="text-sm text-slate-700"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:opacity-95"
            >
              إرسال
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
