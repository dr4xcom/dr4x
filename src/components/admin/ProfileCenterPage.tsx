// src/components/admin/ProfileCenterPage.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";

const BUCKET = "site_assets";
const PROFILE_CENTER_GIF_PATH = "profile-center/global.gif";

type LoadState = "idle" | "loading" | "ready" | "error";
type ActionState = "idle" | "uploading" | "deleting";

export default function ProfileCenterPage() {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function refreshPreview() {
    setLoadState("loading");
    setError("");
    setMessage("");

    try {
      const { data, error: urlErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(PROFILE_CENTER_GIF_PATH, 60 * 60);

      if (urlErr || !data?.signedUrl) {
        console.warn("No global profile-center GIF found yet.");
        setPreviewUrl("");
        setLoadState("ready");
        return;
      }

      const url = data.signedUrl;
      setPreviewUrl(
        url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : ""
      );
      setLoadState("ready");
    } catch (e: any) {
      console.error("refreshPreview error", e);
      setError("تعذر تحميل الصورة الحالية. حاول تحديث الصفحة.");
      setLoadState("error");
    }
  }

  useEffect(() => {
    void refreshPreview();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setMessage("");

    if (file.type !== "image/gif") {
      setError("يجب أن تكون الصورة بصيغة GIF فقط.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("أقصى حجم مسموح للصورة هو 5MB.");
      e.target.value = "";
      return;
    }

    setActionState("uploading");
    try {
      // نرفع دائمًا إلى نفس المسار الثابت — صورة مشتركة للجميع
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(PROFILE_CENTER_GIF_PATH, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadErr) {
        console.error("upload error", uploadErr);
        setError(
          "فشل الرفع. تأكد أن سياسات Storage (RLS) لبكت site_assets تسمح للأدمن بالرفع."
        );
        return;
      }

      setMessage("تم رفع الصورة العامة وتحديثها بنجاح.");
      await refreshPreview();
    } catch (ex: any) {
      console.error("handleFileChange unexpected error", ex);
      setError("حدث خطأ غير متوقع أثناء رفع الصورة. حاول مرة أخرى.");
    } finally {
      setActionState("idle");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete() {
    setError("");
    setMessage("");
    setActionState("deleting");

    try {
      const { error: delErr } = await supabase.storage
        .from(BUCKET)
        .remove([PROFILE_CENTER_GIF_PATH]);

      if (delErr) {
        console.error("delete error", delErr);
        setError(
          "تعذر حذف الصورة. تأكد من صلاحيات RLS لبكت site_assets للسماح للأدمن بالحذف."
        );
        return;
      }

      setPreviewUrl("");
      setMessage("تم حذف الصورة العامة بنجاح.");
    } catch (e: any) {
      console.error("handleDelete unexpected error", e);
      setError("حدث خطأ غير متوقع أثناء حذف الصورة.");
    } finally {
      setActionState("idle");
    }
  }

  const isBusy = actionState !== "idle";

  return (
    <div className="space-y-6">
      {/* العنوان الرئيسي */}
      <div className="text-center space-y-1">
        <div className="text-xs text-emerald-400 tracking-[0.25em] uppercase">
          DR4X // PROFILE_CENTER
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
          مركز صورة البروفايل العامة
        </h1>
        <p className="text-sm text-slate-300 mt-2 max-w-2xl mx-auto">
          من هنا تستطيع رفع أو إزالة صورة GIF تظهر أعلى صفحة الملف الشخصي لكل
          الأعضاء. التحكم بالكامل بيد المدير العام فقط.
        </p>
      </div>

      {/* رسالة خطأ عامة أعلى الصفحة (عند الحاجة) */}
      {error && (
        <div className="rounded-2xl border border-red-500 bg-red-900/40 text-red-50 px-4 py-3 text-sm text-center whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)] gap-6">
        {/* ملاحظة أمنية يسار / يمين حسب RTL */}
        <aside className="w-full lg:w-auto">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 h-full">
            <h2 className="text-base font-semibold mb-2">ملاحظة أمنية</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              الرفع في هذا القسم متاح فقط للحسابات التي تملك صلاحية{" "}
              <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded-lg mx-1">
                admin_users
              </span>{" "}
              عبر دالة{" "}
              <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded-lg mx-1">
                is_admin()
              </span>
              . تأكد أيضًا أن سياسات{" "}
              <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded-lg mx-1">
                Storage
              </span>{" "}
              لبكت{" "}
              <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded-lg mx-1">
                site_assets
              </span>{" "}
              تسمح بالرفع والقراءة حسب الحاجة.
            </p>
          </div>
        </aside>

        {/* بطاقة المعاينة والرفع */}
        <section className="rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950/95 shadow-[0_0_40px_rgba(16,185,129,0.25)] p-5 sm:p-7 space-y-5">
          <div className="text-center mb-2">
            <div className="text-xs text-emerald-400 tracking-[0.25em] uppercase mb-1">
              PROFILE_CENTER_GIF_PREVIEW
            </div>
            <p className="text-xs text-slate-300">
              هذه الصورة المشتركة تظهر في أعلى صفحة الملف الشخصي لكل الأعضاء. لا
              يمكن للأعضاء تغييرها أو حذفها، فقط المدير العام.
            </p>
          </div>

          {/* منطقة المعاينة */}
          <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/80 p-4 sm:p-5 flex items-center justify-center min-h-[180px]">
            {loadState === "loading" ? (
              <div className="text-sm text-slate-300">جاري تحميل الصورة…</div>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="PROFILE_CENTER GIF"
                className="max-h-48 w-full object-contain rounded-2xl"
              />
            ) : (
              <div className="text-center text-sm text-slate-400">
                لا توجد صورة حالياً. يمكنك رفع صورة GIF جديدة بالأسفل.
              </div>
            )}
          </div>

          {/* الأزرار */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className={[
                  "inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold",
                  "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
                  "shadow-[0_0_25px_rgba(16,185,129,0.5)]",
                  isBusy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {actionState === "uploading"
                  ? "جارٍ رفع الصورة…"
                  : "رفع صورة GIF"}
              </button>

              <button
                type="button"
                disabled={isBusy || !previewUrl}
                onClick={handleDelete}
                className={[
                  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold border",
                  "border-red-500 text-red-400 hover:bg-red-500/10",
                  isBusy || !previewUrl ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {actionState === "deleting" ? "جارٍ الحذف…" : "حذف الصورة"}
              </button>
            </div>

            {message && (
              <div className="text-xs text-emerald-400 whitespace-pre-wrap">
                {message}
              </div>
            )}
          </div>

          {/* input مخفي للملف */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </section>
      </div>
    </div>
  );
}
