"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabase/client";
import { Image as ImageIcon, Link2, Video, X } from "lucide-react";

/* =========================
   Helpers
========================= */
function makeSafeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function stripExtension(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function isUrlLike(s: string) {
  const u = (s || "").trim();
  return /^https?:\/\/\S+$/i.test(u);
}

const MAX_IMAGES = 4;

export default function ReplyComposer({
  postId,
  onPosted,
  onCancel,
}: {
  postId: number;
  onPosted: () => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ صور متعددة
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // ✅ رابط يوتيوب
  const [mediaUrl, setMediaUrl] = useState("");
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  const canPost = useMemo(
    () => content.trim().length > 0 && !loading,
    [content, loading]
  );

  useEffect(() => setMounted(true), []);

  /* =========================
     Images
  ========================= */
  function addFiles(list: FileList | null) {
    if (!list) return;

    const remaining = MAX_IMAGES - files.length;
    if (remaining <= 0) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const arr = Array.from(list)
      .filter((f) => f && f.type.startsWith("image/"))
      .slice(0, remaining);

    if (arr.length === 0) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setFiles((p) => [...p, ...arr]);
    setPreviews((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))]);

    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((p) => p.filter((_, i) => i !== index));
    setPreviews((p) => {
      const u = p[index];
      if (u) URL.revokeObjectURL(u);
      return p.filter((_, i) => i !== index);
    });

    if (lightboxOpen) {
      if (index === lightboxIndex) {
        setLightboxOpen(false);
      } else if (index < lightboxIndex) {
        setLightboxIndex((v) => Math.max(0, v - 1));
      }
    }
  }

  // تنظيف ObjectURL
  useEffect(() => {
    return () => {
      previews.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    };
  }, [previews]);

  // ESC + أسهم داخل Lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") setLightboxIndex((v) => Math.max(0, v - 1));
      if (e.key === "ArrowRight") {
        setLightboxIndex((v) => Math.min(previews.length - 1, v + 1));
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen, previews.length]);

  /* =========================
     Storage Upload
  ========================= */
  async function tryUploadOne(
    bucket: string,
    path: string,
    file: File
  ): Promise<{ publicUrl: string | null; error?: string }> {
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    if (upErr) return { publicUrl: null, error: upErr.message };

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { publicUrl: data?.publicUrl ?? null };
  }

  async function uploadReplyImagesOrSkip(
    userId: string,
    selected: File[]
  ): Promise<{
    imageUrls: string[];
    storageFailed: boolean;
    storageErrorMessage?: string;
  }> {
    if (selected.length === 0) return { imageUrls: [], storageFailed: false };

    const bucket = "post_media";
    const urls: string[] = [];

    for (const f of selected) {
      const extFromName = f.name.split(".").pop();
      const ext = (extFromName || "jpg").toLowerCase();

      const safeBase = makeSafeFilename(stripExtension(f.name));
      const baseName = `${Date.now()}_${safeBase}.${ext}`;

      const path1 = `${userId}/replies/${postId}/${baseName}`;
      const path2 = `${userId}/posts/replies/${postId}/${baseName}`;

      const r1 = await tryUploadOne(bucket, path1, f);
      if (r1.publicUrl) {
        urls.push(r1.publicUrl);
        continue;
      }

      const r2 = await tryUploadOne(bucket, path2, f);
      if (r2.publicUrl) {
        urls.push(r2.publicUrl);
        continue;
      }

      const msg = (r2.error || r1.error || "Storage upload failed").trim();
      return { imageUrls: [], storageFailed: true, storageErrorMessage: msg };
    }

    return { imageUrls: urls, storageFailed: false };
  }

  /* =========================
     Submit
  ========================= */
  async function handleReply() {
    const text = content.trim();
    if (!text || loading) return;

    setLoading(true);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      setLoading(false);
      alert("يجب تسجيل الدخول");
      return;
    }

    let finalContent = text;
    let youtube_url: string | null = null;

    const url = mediaUrl.trim();
    if (url && isUrlLike(url)) {
      const lower = url.toLowerCase();
      const isYouTube = lower.includes("youtube.com") || lower.includes("youtu.be");
      if (isYouTube) youtube_url = url;
      else finalContent = `${finalContent}\n${url}`;
    }

    let image_urls: string[] = [];
    let storageFailed = false;
    let storageErrorMessage = "";

    if (files.length > 0) {
      const up = await uploadReplyImagesOrSkip(user.id, files);
      image_urls = up.imageUrls;
      storageFailed = up.storageFailed;
      storageErrorMessage = up.storageErrorMessage || "";
    }

    const { error } = await supabase.from("replies").insert({
      post_id: postId,
      user_id: user.id,
      content: finalContent,
      image_urls,
      youtube_url,
    });

    setLoading(false);

    if (error) {
      console.error(error);
      alert(`فشل إرسال الرد: ${error.message}`);
      return;
    }

    if (storageFailed) {
      alert(`⚠️ تم إرسال الرد بدون صور لأن رفع الصور فشل.\n${storageErrorMessage}`);
    }

    setContent("");
    setMediaUrl("");

    previews.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    });
    setPreviews([]);
    setFiles([]);
    setLightboxOpen(false);

    onPosted();
    onCancel();
  }

  const gridCols = previews.length <= 1 ? "grid-cols-1" : "grid-cols-2";
  const isSingle = previews.length === 1;

  /* =========================
     Lightbox UI (Portal)
  ========================= */
  const lightbox = mounted && lightboxOpen && previews[lightboxIndex]
    ? createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => setLightboxOpen(false)}
            aria-hidden
          />
          <div className="relative max-w-[92vw] max-h-[92vh] z-[10000]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previews[lightboxIndex]}
              alt="preview"
              className="max-w-[92vw] max-h-[92vh] object-contain rounded-2xl"
            />

            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 rounded-full bg-white/90 p-2 hover:bg-white transition"
              title="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>

            {previews.length > 1 ? (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setLightboxIndex((v) => Math.max(0, v - 1))}
                  disabled={lightboxIndex === 0}
                  className="rounded-full bg-white/90 px-3 py-2 text-sm disabled:opacity-50"
                >
                  السابق
                </button>
                <div className="text-white/90 text-sm">
                  {lightboxIndex + 1} / {previews.length}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex((v) => Math.min(previews.length - 1, v + 1))
                  }
                  disabled={lightboxIndex === previews.length - 1}
                  className="rounded-full bg-white/90 px-3 py-2 text-sm disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {lightbox}

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="اكتب ردك..."
          className="w-full resize-none bg-transparent outline-none text-sm placeholder:text-slate-400 min-h-[44px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleReply();
            }
          }}
        />

        {/* ✅ مكان الرابط (أغمق وواضح) */}
        <div className="mt-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 focus-within:bg-slate-200 transition">
            <Video className="h-4 w-4 text-slate-600 shrink-0" />
            <input
              ref={mediaInputRef}
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="ضع رابط YouTube هنا (اختياري)"
              className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-500"
              dir="ltr"
            />
            {mediaUrl ? (
              <button
                type="button"
                onClick={() => setMediaUrl("")}
                className="text-slate-500 hover:text-slate-900"
                title="مسح الرابط"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* ✅ معاينة الصور + تكبير */}
        {previews.length > 0 ? (
          <div className={`mt-3 grid ${gridCols} gap-2`}>
            {previews.map((src, idx) => (
              <div
                key={`${src}-${idx}`}
                onClick={() => {
                  setLightboxIndex(idx);
                  setLightboxOpen(true);
                }}
                className={[
                  "relative rounded-xl overflow-hidden bg-slate-100 cursor-zoom-in",
                  isSingle ? "h-[200px]" : "h-[130px]",
                ].join(" ")}
                title="اضغط للتكبير"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightboxIndex(idx);
                    setLightboxOpen(true);
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="reply" className="w-full h-full object-cover" />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="absolute top-2 left-2 rounded-full bg-black/60 text-white p-1.5 hover:bg-black/70 transition"
                  title="حذف الصورة"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={files.length >= MAX_IMAGES}
              className={[
                "inline-flex items-center gap-2 text-sm transition",
                files.length >= MAX_IMAGES
                  ? "text-slate-400 cursor-not-allowed"
                  : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
              title="إضافة صور"
            >
              <ImageIcon className="h-4 w-4" />
              <span className="text-xs text-slate-500">
                {files.length}/{MAX_IMAGES}
              </span>
            </button>

            <button
              type="button"
              onClick={() => mediaInputRef.current?.focus()}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
              title="إضافة رابط"
            >
              <Link2 className="h-4 w-4" />
              <span>رابط</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-slate-600 hover:text-slate-900 transition"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleReply}
              disabled={!canPost}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                canPost
                  ? "bg-slate-900 text-white hover:opacity-95"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed",
              ].join(" ")}
            >
              {loading ? "جارٍ الإرسال..." : "رد"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
