"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import type { LibraryCategory } from "@/components/library/types";
import { fetchCategories } from "@/components/library/lib";
import LibraryHeader from "@/components/library/LibraryHeader";

const BUCKET = "clinic";

/* ========================= Helpers ========================= */

function safeName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-\.]+/g, "")
    .slice(0, 120);
}

function formatSupabaseError(e: any) {
  const msg =
    typeof e?.message === "string"
      ? e.message
      : typeof e === "string"
      ? e
      : "حدث خطأ غير معروف";
  const code = e?.status ? ` (${e.status})` : "";
  return `${msg}${code}`;
}

function isSafeHttpUrl(url: string) {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    return true;
  } catch {
    return false;
  }
}

function stripQuery(u: string) {
  try {
    const x = new URL(u);
    x.hash = "";
    x.search = "";
    return x.toString();
  } catch {
    return u;
  }
}

function isImageUrl(url: string) {
  const s = stripQuery(url).toLowerCase();
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(s);
}

function isPdfUrl(url: string) {
  const s = stripQuery(url).toLowerCase();
  return /\.pdf$/i.test(s);
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("يلزم تسجيل الدخول أولاً قبل إرسال الكتاب.");
  return data.user;
}

function bytesToNice(n: number) {
  if (!Number.isFinite(n)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/* ========================= Storage Upload ========================= */
/**
 * سياسة clinic عندك تطلب نمط معين في المسار.
 * ✅ النمط الذي نجح عندك:
 * clinic/patient_files/{userId}/{userId}/library/...
 */
async function uploadToClinic(opts: {
  userId: string;
  kind: "covers" | "previews" | "full";
  file: File;
  baseName: string;
}) {
  const { userId, kind, file, baseName } = opts;

  const cleanBase = safeName(baseName || "file");
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const cleanExt = safeName(ext || "").toLowerCase();
  const finalName = cleanExt ? `${cleanBase}_${Date.now()}.${cleanExt}` : `${cleanBase}_${Date.now()}`;

  const path = `patient_files/${userId}/${userId}/library/${kind}/${finalName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
    cacheControl: "3600",
  });

  if (error) throw error;
  return path;
}

/* ========================= UI Components ========================= */

function UploadBox(props: {
  label: string;
  accept?: string;
  file: File | null;
  disabled?: boolean;
  onPick: (f: File | null) => void;
  hint?: string;
}) {
  const { label, accept, file, disabled, onPick, hint } = props;

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-slate-200">{label}</div>

      <label
        className={[
          "block w-full rounded-2xl border-2 border-dashed",
          "bg-slate-900/90", // ✅ لون خانات المكتبة
          file ? "border-emerald-400" : "border-slate-600",
          "text-slate-100 px-4 py-4 transition",
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:opacity-95",
        ].join(" ")}
        title="اضغط داخل الصندوق لاختيار ملف"
      >
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold">{file ? "✅ تم اختيار ملف" : "اضغط هنا لاختيار ملف"}</div>
            {hint ? <div className="mt-1 text-xs text-slate-300">{hint}</div> : null}

            {file ? (
              <div className="mt-2 text-sm text-slate-300 break-words">
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-slate-400">
                  {bytesToNice(file.size)} {file.type ? `• ${file.type}` : ""}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-400">
                لم يتم اختيار ملف بعد — اضغط داخل المربع الغامق
              </div>
            )}
          </div>

          <span className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs text-slate-100">
            {file ? "تغيير" : "تصفح الملفات"}
          </span>
        </div>
      </label>
    </div>
  );
}

function TextInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
}) {
  const { label, value, onChange, placeholder, disabled, type } = props;
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium text-slate-200">{label}</span>
      <input
        type={type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 placeholder:text-slate-500"
      />
    </label>
  );
}

/* ========================= Page ========================= */

type SubmitMode = "upload" | "external";

export default function LibrarySubmitPage() {
  const [cats, setCats] = useState<LibraryCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const [mode, setMode] = useState<SubmitMode>("upload");
  const [submitting, setSubmitting] = useState(false);

  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // Upload files
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [fullFile, setFullFile] = useState<File | null>(null);

  // External links
  const [coverUrl, setCoverUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState(""); // اختياري

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCats(true);
        const list = await fetchCategories();
        if (!mounted) return;
        setCats(list || []);
        if (!categoryId && list?.[0]?.id) setCategoryId(list[0].id);
      } catch (e: any) {
        if (!mounted) return;
        setErr(`فشل تحميل التصنيفات: ${formatSupabaseError(e)}`);
      } finally {
        if (!mounted) return;
        setLoadingCats(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = useMemo(() => {
    if (loadingCats || submitting) return false;
    if (!title.trim() || !authorName.trim() || !categoryId) return false;

    if (mode === "upload") {
      return !!coverFile && !!previewFile && !!fullFile;
    }

    // external
    return !!coverUrl.trim() && !!pdfUrl.trim();
  }, [loadingCats, submitting, title, authorName, categoryId, mode, coverFile, previewFile, fullFile, coverUrl, pdfUrl]);

  function validateExternalLinks() {
    const c = coverUrl.trim();
    const p = pdfUrl.trim();
    const pr = previewUrl.trim();

    if (!isSafeHttpUrl(c)) throw new Error("رابط الغلاف غير صالح. يجب أن يبدأ بـ http أو https.");
    if (!isImageUrl(c))
      throw new Error("رابط الغلاف يجب أن يكون صورة مباشرة (png/jpg/jpeg/webp/gif).");

    if (!isSafeHttpUrl(p)) throw new Error("رابط PDF غير صالح. يجب أن يبدأ بـ http أو https.");
    if (!isPdfUrl(p)) throw new Error("رابط PDF يجب أن ينتهي بـ .pdf ويكون رابط تحميل مباشر.");

    if (pr) {
      if (!isSafeHttpUrl(pr)) throw new Error("رابط المعاينة غير صالح. يجب أن يبدأ بـ http أو https.");
      if (!isPdfUrl(pr)) throw new Error("رابط المعاينة يجب أن ينتهي بـ .pdf.");
    }
  }

  async function insertBookRow(payload: {
    title: string;
    author_name: string;
    category_id: string;
    cover_path: string;
    preview_file_path: string | null;
    full_file_path: string;
    submitted_by_user_id: string;
    status?: string;
  }) {
    // نحاول إدخال الحد الأدنى الآمن
    const { error } = await supabase.from("library_books").insert({
      title: payload.title,
      author_name: payload.author_name,
      category_id: payload.category_id,
      cover_path: payload.cover_path,
      preview_file_path: payload.preview_file_path,
      full_file_path: payload.full_file_path,
      submitted_by_user_id: payload.submitted_by_user_id,
      status: payload.status ?? "pending",
    });

    if (error) throw error;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);

    try {
      setSubmitting(true);

      const user = await requireUser();

      if (!title.trim() || !authorName.trim() || !categoryId) {
        throw new Error("الرجاء تعبئة: عنوان الكتاب + اسم المؤلف + التصنيف.");
      }

      if (mode === "upload") {
        if (!coverFile || !previewFile || !fullFile) {
          throw new Error("الرجاء اختيار الملفات الثلاثة: الغلاف + المعاينة + الملف الكامل.");
        }

        // 1) Upload to clinic bucket
        const coverPath = await uploadToClinic({
          userId: user.id,
          kind: "covers",
          file: coverFile,
          baseName: `${title}_cover`,
        });

        const previewPath = await uploadToClinic({
          userId: user.id,
          kind: "previews",
          file: previewFile,
          baseName: `${title}_preview`,
        });

        const fullPath = await uploadToClinic({
          userId: user.id,
          kind: "full",
          file: fullFile,
          baseName: `${title}_full`,
        });

        // 2) Insert row in library_books
        await insertBookRow({
          title: title.trim(),
          author_name: authorName.trim(),
          category_id: categoryId,
          cover_path: coverPath,
          preview_file_path: previewPath,
          full_file_path: fullPath,
          submitted_by_user_id: user.id,
          status: "pending",
        });

        // reset
        setCoverFile(null);
        setPreviewFile(null);
        setFullFile(null);
      } else {
        // External mode
        validateExternalLinks();

        await insertBookRow({
          title: title.trim(),
          author_name: authorName.trim(),
          category_id: categoryId,
          cover_path: coverUrl.trim(), // ✅ external image URL stored here
          preview_file_path: previewUrl.trim() ? previewUrl.trim() : null, // optional
          full_file_path: pdfUrl.trim(), // ✅ external PDF URL stored here
          submitted_by_user_id: user.id,
          status: "pending",
        });

        setCoverUrl("");
        setPdfUrl("");
        setPreviewUrl("");
      }

      setOk(true);
    } catch (e: any) {
      setErr(`❌ تعذّر إرسال الكتاب.\n\n${formatSupabaseError(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-900">
      <LibraryHeader />

      {/* ✅ المساحة خارج الفورم 80% (95% للجوال) */}
      <div className="mx-auto w-[95%] md:w-[80%] px-6 py-8">
        {/* ✅ الفورم في المنتصف بعرض مريح */}
        <div className="mx-auto max-w-3xl bg-slate-900 rounded-3xl border border-white/10 p-6">
          <h1 className="text-xl font-semibold text-slate-100 mb-4">رفع كتاب</h1>

          {ok ? (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              ✅ تم إرسال الكتاب بنجاح — سيظهر في المكتبة حسب حالة المراجعة/الموافقة.
            </div>
          ) : null}

          {err ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 whitespace-pre-wrap">
              {err}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Mode Toggle */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-slate-200 mb-2">طريقة الإضافة</div>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 text-slate-200">
                  <input
                    type="radio"
                    name="mode"
                    value="upload"
                    checked={mode === "upload"}
                    onChange={() => setMode("upload")}
                  />
                  رفع ملفات (داخل الموقع)
                </label>

                <label className="inline-flex items-center gap-2 text-slate-200">
                  <input
                    type="radio"
                    name="mode"
                    value="external"
                    checked={mode === "external"}
                    onChange={() => setMode("external")}
                  />
                  روابط خارجية (صورة + PDF)
                </label>
              </div>

              {mode === "external" ? (
                <div className="mt-2 text-xs text-slate-400">
                  ⚠️ الروابط الخارجية لا يتم رفعها إلى التخزين؛ يتم حفظ الرابط فقط. إذا حذف المصدر الملف قد يتوقف الرابط.
                </div>
              ) : null}
            </div>

            {/* Common fields */}
            <TextInput
              label="عنوان الكتاب"
              value={title}
              onChange={setTitle}
              placeholder="مثال: كتاب طبي"
              disabled={submitting}
            />

            <TextInput
              label="اسم المؤلف"
              value={authorName}
              onChange={setAuthorName}
              placeholder="مثال: د. فلان"
              disabled={submitting}
            />

            <label className="block space-y-1">
              <span className="block text-sm font-medium text-slate-200">التصنيف</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={submitting || loadingCats}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100"
              >
                {cats.length === 0 ? (
                  <option value="">لا توجد تصنيفات</option>
                ) : (
                  cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
              {loadingCats ? <div className="text-xs text-slate-400">جارٍ تحميل التصنيفات...</div> : null}
            </label>

            {/* Upload mode */}
            {mode === "upload" ? (
              <div className="space-y-4">
                <UploadBox
                  label="صورة الغلاف"
                  accept="image/*"
                  file={coverFile}
                  disabled={submitting}
                  onPick={setCoverFile}
                  hint="اضغط داخل الصندوق الغامق لفتح مكتبة الصور"
                />

                <UploadBox
                  label="ملف المعاينة (Preview)"
                  accept="application/pdf"
                  file={previewFile}
                  disabled={submitting}
                  onPick={setPreviewFile}
                  hint="اختر ملف PDF للمعاينة"
                />

                <UploadBox
                  label="الملف الكامل (Full)"
                  accept="application/pdf"
                  file={fullFile}
                  disabled={submitting}
                  onPick={setFullFile}
                  hint="اختر ملف PDF كامل"
                />
              </div>
            ) : null}

            {/* External mode */}
            {mode === "external" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4">
                  <div className="text-sm font-medium text-slate-100 mb-3">روابط خارجية</div>

                  <TextInput
                    label="رابط صورة الغلاف (Image URL)"
                    value={coverUrl}
                    onChange={setCoverUrl}
                    placeholder="مثال: https://example.com/cover.png"
                    disabled={submitting}
                    type="url"
                  />

                  <div className="mt-3" />

                  <TextInput
                    label="رابط PDF (للتصفح/التحميل)"
                    value={pdfUrl}
                    onChange={setPdfUrl}
                    placeholder="مثال: https://example.com/book.pdf"
                    disabled={submitting}
                    type="url"
                  />

                  <div className="mt-3" />

                  <TextInput
                    label="رابط معاينة PDF (اختياري)"
                    value={previewUrl}
                    onChange={setPreviewUrl}
                    placeholder="مثال: https://example.com/preview.pdf"
                    disabled={submitting}
                    type="url"
                  />

                  {/* Light preview of cover */}
                  <div className="mt-4">
                    <div className="text-xs text-slate-300 mb-2">معاينة الغلاف (إن كان الرابط صحيح):</div>
                    <div className="rounded-2xl border border-white/10 bg-slate-900 p-3">
                      {coverUrl.trim() && isSafeHttpUrl(coverUrl.trim()) ? (
                        // نستخدم img عشان ما نحتاج تعديل next.config.js
                        <img
                          src={coverUrl.trim()}
                          alt="Cover preview"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-56 object-cover rounded-xl bg-slate-800"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="text-sm text-slate-400">ضع رابط صورة صحيح لمعاينتها هنا.</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-400">
                    ✔ مسموح فقط بروابط http/https
                    <br />
                    ✔ الغلاف يجب أن يكون صورة مباشرة (png/jpg/jpeg/webp/gif)
                    <br />
                    ✔ رابط الكتاب يجب أن يكون PDF مباشر وينتهي بـ .pdf
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className={[
                "rounded-2xl px-4 py-2 font-medium",
                !canSubmit
                  ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                  : "bg-slate-100 text-slate-900 hover:opacity-90",
              ].join(" ")}
            >
              {submitting ? "جارٍ الإرسال..." : "إرسال"}
            </button>

            <div className="text-xs text-slate-500">
              ملاحظة: نحن لا نغيّر أي سياسات Storage أو RLS. في وضع الرفع يتم التخزين داخل bucket clinic فقط. وفي وضع الروابط
              الخارجية يتم حفظ الروابط في الجدول فقط.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
