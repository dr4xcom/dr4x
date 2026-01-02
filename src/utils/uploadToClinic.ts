"use client";

import { supabase } from "@/utils/supabase/client";

/**
 * رفع الملفات إلى Bucket: clinic
 * - يخزن PATH فقط (ليس رابط)
 * - آمن
 * - لا يغيّر أي جداول أو سياسات
 */
export async function uploadToClinic(
  file: File,
  folder: "profiles" | "ui" | "chat" | "library"
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error("فشل جلب المستخدم");
  }

  const userId = user?.id ?? "guest";

  // استخراج الامتداد
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";

  // اسم ملف فريد
  const fileName = `${Date.now()}.${ext}`;

  // المسار داخل البكت
  const path = `${folder}/${userId}/${fileName}`;

  // ✅ اسم البكت صغير
  const { error } = await supabase.storage
    .from("clinic")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
    throw new Error(error.message || "فشل رفع الملف");
  }

  // نُرجع PATH فقط
  return path;
}
