// src/components/posts/NewPostComposer.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { Image as ImageIcon, Youtube, Video, X, Smile } from "lucide-react";
import Image from "next/image";
import VoiceAssistant from "@/components/ai/VoiceAssistant";

const QUICK_EMOJIS = [
  "😀",
  "😍",
  "😂",
  "🔥",
  "👍",
  "🙏",
  "💙",
  "✅",
  "✨",
  "🥹",
];

type ProfileMini = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function makeSafeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isUrlLike(s: string) {
  const u = (s || "").trim();
  if (!u) return false;
  return /^https?:\/\/\S+$/i.test(u);
}

/* =========================
   ✅ للمعاينة فقط
   ========================= */
function extractYouTubeId(url: string): string | null {
  const u = (url || "").trim();
  if (!u) return null;

  // youtu.be/<id>
  const m1 = u.match(/youtu\.be\/([^?&/]+)/i);
  if (m1?.[1]) return m1[1];

  // youtube.com/watch?v=<id>
  const m2 = u.match(/[?&]v=([^?&/]+)/i);
  if (m2?.[1]) return m2[1];

  // youtube.com/shorts/<id>
  const m3 = u.match(/youtube\.com\/shorts\/([^?&/]+)/i);
  if (m3?.[1]) return m3[1];

  return null;
}

export default function NewPostComposer({
  onPosted,
}: {
  onPosted?: () => void;
}) {
  // ✅ الأفاتار فقط
  const [profile, setProfile] = useState<ProfileMini | null>(null);

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ صور
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  // ✅ فيديو من الجهاز
  const videoFileRef = useRef<HTMLInputElement | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  // ✅ ايموجي
  const [showEmoji, setShowEmoji] = useState(false);

  // ✅ رابط فيديو خارجي (يوتيوب وغيرها)
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setProfile((prof as any) ?? null);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    const base =
      profile?.full_name?.trim() || profile?.username?.trim() || "DR";
    return ((base[0] ?? "D") + (base[1] ?? "R")).toUpperCase();
  }, [profile]);

  const canPost = useMemo(() => {
    const hasText = content.trim().length > 0;
    const hasMedia =
      selectedFiles.length > 0 || !!selectedVideo || isUrlLike(videoUrl);

    return !loading && (hasText || hasMedia);
  }, [content, selectedFiles.length, selectedVideo, videoUrl, loading]);

  function pickImages() {
    fileRef.current?.click();
  }

  function onFilesChosen(files: FileList | null) {
    if (!files || files.length === 0) return;

    const arr = Array.from(files);
    const nextPreviews = arr.map((f) => URL.createObjectURL(f));

    setSelectedFiles((prev) => [...prev, ...arr]);
    setPreviewImages((prev) => [...prev, ...nextPreviews]);
  }

  function removeImage(idx: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviewImages((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function addEmoji(e: string) {
    setContent((p) => (p + e).slice(0, 5000));
    setShowEmoji(false);
  }

  async function uploadImages(userId: string) {
    if (selectedFiles.length === 0) return [];

    const urls: string[] = [];

    for (const f of selectedFiles) {
      const safe = makeSafeFilename(f.name || "image");
      const path = `${userId}/posts/${Date.now()}_${safe}`;

      const { error: upErr } = await supabase.storage
        .from("post_media")
        .upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type || undefined,
        });

      if (upErr) throw new Error(upErr.message);

      const { data } = supabase.storage.from("post_media").getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  }

  async function uploadVideo(userId: string) {
    if (!selectedVideo) return null;

    const safe = makeSafeFilename(selectedVideo.name || "video");
    const path = `${userId}/videos/${Date.now()}_${safe}`;

    const { error: upErr } = await supabase.storage
      .from("post_media")
      .upload(path, selectedVideo, {
        cacheControl: "3600",
        upsert: false,
        contentType: selectedVideo.type || undefined,
      });

    if (upErr) throw new Error(upErr.message);

    const { data } = supabase.storage.from("post_media").getPublicUrl(path);
    return data?.publicUrl ?? null;
  }

  function pickVideo() {
    videoFileRef.current?.click();
  }

  function onVideoChosen(files: FileList | null) {
    if (!files || files.length === 0) return;

    const file = files[0];

    // نظف المعاينة القديمة لو موجودة
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setSelectedVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  // رابط فيديو خارجي (يوتيوب إلخ)
  function promptVideoUrl() {
    const current = videoUrl.trim();
    const p = window.prompt(
      "ضع رابط فيديو يوتيوب (يمكن أيضًا روابط أخرى مثل TikTok/Instagram):",
      current || ""
    );
    if (p === null) return;

    const v = p.trim();
    if (!v) {
      setVideoUrl("");
      return;
    }

    if (!isUrlLike(v)) {
      alert("الرابط غير صحيح");
      return;
    }

    setVideoUrl(v);
  }

  async function handlePost() {
    if (!canPost) return;

    setLoading(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        alert("يجب تسجيل الدخول");
        setLoading(false);
        return;
      }

      const mediaUrls = await uploadImages(user.id);
      const uploadedVideoUrl = await uploadVideo(user.id);

      const v = videoUrl.trim();
      const videoUrls: string[] = [];
      if (uploadedVideoUrl) videoUrls.push(uploadedVideoUrl);
      if (isUrlLike(v)) videoUrls.push(v);

      // ✅ هنا التعديل المهم: content لا يكون NULL
      const text = content.trim();
      const contentValue = text.length ? text : "";

      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: contentValue, // سترنق حتى لو ما كتبت شيء
        image_paths: mediaUrls.length ? mediaUrls : [],
        video_urls: videoUrls.length ? videoUrls : [],
        is_retweet: false,
        original_post_id: null,
        view_count: 0,
      });

      if (error) throw new Error(error.message);

      // تنظيف المعاينات
      previewImages.forEach((u) => URL.revokeObjectURL(u));
      if (videoPreview) URL.revokeObjectURL(videoPreview);

      setContent("");
      setSelectedFiles([]);
      setPreviewImages([]);
      setSelectedVideo(null);
      setVideoPreview(null);
      setVideoUrl("");
      setShowEmoji(false);

      onPosted?.();
    } catch (e: any) {
      alert(e?.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     ✅ قيم المعاينة فقط
     ========================= */
  const youtubeId = useMemo(() => {
    const u = videoUrl.trim();
    if (!u) return null;
    const lower = u.toLowerCase();
    const isYouTube =
      lower.includes("youtube.com") || lower.includes("youtu.be");
    if (!isYouTube) return null;
    return extractYouTubeId(u);
  }, [videoUrl]);

  return (
    <div className="dr4x-card p-4 mb-3">
      <div className="flex items-start gap-3">
        {/* ✅ أفاتار على اليمين */}
        <div className="shrink-0">
          {profile?.avatar_url ? (
            <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-white">
              <Image
                src={profile.avatar_url}
                alt="avatar"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-bold">
              {initials}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900 mb-2">
            ماذا يحدث؟
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="اكتب منشورك..."
            className="w-full min-h-[110px] resize-none outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* ✅ معاينة الصور */}
      {previewImages.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {previewImages.map((src, idx) => (
            <div
              key={idx}
              className="relative w-[160px] h-[90px] rounded-xl overflow-hidden bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 left-1 inline-flex items-center justify-center h-7 w-7 rounded-full bg-black/60 text-white"
                title="حذف"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* ✅ معاينة فيديو مرفوع من الجهاز */}
      {videoPreview ? (
        <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-black">
          <video src={videoPreview} controls className="w-full h-auto" />

          <div className="flex items-center gap-2 p-2 bg-black/60 text-white text-xs">
            <Video className="h-4 w-4" />
            <span className="truncate">فيديو مرفوع من جهازك</span>
            <button
              type="button"
              onClick={() => {
                if (videoPreview) URL.revokeObjectURL(videoPreview);
                setSelectedVideo(null);
                setVideoPreview(null);
              }}
              className="ms-auto inline-flex items-center justify-center h-7 w-7 rounded-full hover:bg-white/10"
              title="حذف الفيديو"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ✅ معاينة YouTube أو رابط خارجي */}
      {youtubeId ? (
        <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-black">
          <div className="relative w-full aspect-video">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="YouTube preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="flex items-center gap-2 p-2 bg-black/60 text-white text-xs">
            <Youtube className="h-4 w-4" />
            <span className="truncate">{videoUrl}</span>
            <button
              type="button"
              onClick={() => setVideoUrl("")}
              className="ms-auto inline-flex items-center justify-center h-7 w-7 rounded-full hover:bg-white/10"
              title="حذف رابط الفيديو"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : isUrlLike(videoUrl) ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <Youtube className="h-4 w-4" />
          <span className="truncate">{videoUrl}</span>
          <button
            type="button"
            onClick={() => setVideoUrl("")}
            className="ms-auto inline-flex items-center justify-center h-7 w-7 rounded-full hover:bg-slate-100"
            title="حذف رابط الفيديو"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* ✅ شريط الأدوات + زر نشر */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-4 text-slate-500">
          {/* زر رابط يوتيوب */}
          <button
            type="button"
            onClick={promptVideoUrl}
            className="hover:text-red-600 transition"
            title="إرفاق رابط فيديو يوتيوب"
          >
            <Youtube className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setShowEmoji((p) => !p)}
            className="hover:text-slate-900 transition"
            title="إيموجي"
          >
            <Smile className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={pickImages}
            className="hover:text-slate-900 transition"
            title="إرفاق صورة"
          >
            <ImageIcon className="h-5 w-5" />
          </button>

          {/* زر رفع فيديو من الجهاز */}
          <button
            type="button"
            onClick={pickVideo}
            className="hover:text-slate-900 transition"
            title="رفع فيديو من الجهاز"
          >
            <Video className="h-5 w-5" />
          </button>
        </div>

        {/* ✅ زر الذكاء في الوسط بين أيقونة الكاميرا وزر النشر (بدون تغيير أي شيء آخر) */}
        <div className="flex-1 flex justify-center">
          <VoiceAssistant variant="inline" />
        </div>

        <button
          type="button"
          onClick={handlePost}
          disabled={!canPost}
          className="rounded-full px-5 py-2 text-sm font-semibold bg-slate-900 text-white disabled:opacity-50"
        >
          {loading ? "جاري النشر..." : "نشر"}
        </button>
      </div>

      {/* ✅ ايموجي سريع */}
      {showEmoji ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => addEmoji(e)}
                className="h-9 w-9 rounded-xl border border-slate-200 hover:bg-slate-50 grid place-items-center text-lg"
                title={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* مدخل الصور */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFilesChosen(e.target.files)}
      />

      {/* مدخل الفيديو من الجهاز */}
      <input
        ref={videoFileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => onVideoChosen(e.target.files)}
      />
    </div>
  );
}
