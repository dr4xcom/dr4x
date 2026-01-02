// src/components/media/ImageLightbox.tsx
"use client";

import React, { useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Lock } from "lucide-react";

/* =========================
   ✅ Lightbox
   - خلفية سوداء شفافة (أغمق): bg-black/50 + blur
   - الضغط على الخلفية يقفل
   - الضغط على الصورة يقفل
   - Esc يقفل
   - الأسهم تتنقل
   ========================= */
export default function ImageLightbox({
  open,
  images,
  index,
  onClose,
  onIndexChange,
}: {
  open: boolean;
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight")
        onIndexChange(Math.min(images.length - 1, index + 1));
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
    };

    document.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, onIndexChange, images.length, index]);

  if (!open) return null;

  const src = images[index] || "";

  return (
    <div className="fixed inset-0 z-[9999]" onClick={onClose}>
      {/* ✅ الخلفية: أسود شفاف أغمق */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* ✅ المحتوى */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-5xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ✅ أزرار أعلى */}
          <div className="absolute -top-12 end-0 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-black/10 text-slate-900 hover:bg-black/15"
              aria-label="رجوع"
              title="رجوع"
            >
              <Lock className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-black/10 text-slate-900 hover:bg-black/15"
              aria-label="إغلاق"
              title="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ✅ أسهم التنقل */}
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange(Math.max(0, index - 1));
                }}
                disabled={index === 0}
                className="absolute top-1/2 -translate-y-1/2 -start-12 inline-flex items-center justify-center h-10 w-10 rounded-full bg-black/10 text-slate-900 hover:bg-black/15 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="السابق"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange(Math.min(images.length - 1, index + 1));
                }}
                disabled={index === images.length - 1}
                className="absolute top-1/2 -translate-y-1/2 -end-12 inline-flex items-center justify-center h-10 w-10 rounded-full bg-black/10 text-slate-900 hover:bg-black/15 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="التالي"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}

          {/* ✅ الضغط على الصورة نفسها يقفل */}
          <div className="w-full rounded-2xl overflow-hidden bg-white/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="preview"
              className="w-full max-h-[85dvh] object-contain select-none cursor-zoom-out"
              draggable={false}
              onClick={() => onClose()}
            />
          </div>

          {images.length > 1 ? (
            <div className="mt-3 text-center text-xs text-slate-200">
              {index + 1} / {images.length}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
