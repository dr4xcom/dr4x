// src/components/profile/AvatarUploader.tsx
"use client";

import React, { useState } from "react";
import { supabase } from "@/utils/supabase/client";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

export default function AvatarUploader() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setMessage(null);

    if (!file) return;

    // ✅ 1) التحقق من نوع الملف
    if (!ALLOWED_MIME.includes(file.type)) {
      setError("مسموح فقط برفع صور من نوع JPG أو PNG أو WEBP.");
      return;
    }

    // ✅ 2) التحقق من حجم الملف
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_SIZE_MB) {
      setError(`الحجم الأقصى للصورة هو ${MAX_SIZE_MB} ميجابايت.`);
      return;
    }

    try {
      setUploading(true);

      // ✅ 3) نجيب المستخدم الحالي
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setError("يجب تسجيل الدخول أولاً.");
        return;
      }

      const userId = user.id;

      // ✅ 4) نحدد الامتداد حسب نوع الملف
      let ext = ".jpg";
      if (file.type === "image/png") ext = ".png";
      else if (file.type === "image/webp") ext = ".webp";

      // نخلي الاسم ثابت: avatar مع الامتداد الصحيح داخل مجلد المستخدم
      const path = `${userId}/avatar${ext}`;

      // (اختياري) نحذف الملف القديم لو موجود
      await supabase.storage.from("avatars").remove([path]);

      // ✅ 5) رفع الصورة إلى البكت avatars
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          upsert: true,
        });

      if (uploadErr) {
        console.error(uploadErr);
        setError("حدث خطأ أثناء رفع الصورة.");
        return;
      }

      // ✅ 6) حفظ المسار في profiles.avatar_path
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", userId);

      if (updateErr) {
        console.error(updateErr);
        setError("تم رفع الصورة لكن فشل حفظ المسار في البروفايل.");
        return;
      }

      setMessage("تم تحديث صورة البروفايل بنجاح.");
    } finally {
      setUploading(false);
      // نفرغ الإختيار عشان يقدر يرفع نفس الملف مرة ثانية
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <span className="px-3 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold">
          {uploading ? "جارٍ الرفع..." : "تغيير صورة البروفايل"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFileChange}
          disabled={uploading}
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && <p className="text-xs text-emerald-600">{message}</p>}
    </div>
  );
}
