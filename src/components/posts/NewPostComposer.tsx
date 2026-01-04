// src/components/posts/NewPostComposer.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { Image as ImageIcon, Link2, Video, X, Smile } from "lucide-react";
import Image from "next/image";

// ✅ نفس الأدوات المستخدمة في PostCard
import { getDisplayName, getInitials } from "@/lib/postsFeed/utils";

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
const AVATAR_BUCKET = "avatars";

type ProfileMini = {
  id?: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  avatar_path?: string | null;
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
   معاينة يوتيوب فقط
   ========================= */
function extractYouTubeId(url: string): string | null {
  const u = (url || "").trim();
  if (!u) return null;

  const m1 = u.match(/youtu\.be\/([^?&/]+)/i);
  if (m1?.[1]) return m1[1];

  const m2 = u.match(/[?&]v=([^?&/]+)/i);
  if (m2?.[1]) return m2[1];

  const m3 = u.match(/youtube\.com\/shorts\/([^?&/]+)/i);
  if (m3?.[1]) return m3[1];

  return null;
}

export default function NewPostComposer({
  onPosted,
}: {
  onPosted?: () => void;
}) {
  // ✅ بيانات البروفايل + الأفاتار
  const [profile, setProfile] = useState<ProfileMini | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ صور
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  // ✅ ايموجي
  const [showEmoji, setShowEmoji] = useState(false);

  // ✅ رابط فيديو (من أيقونة الفيديو فقط)
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
        .select("id, full_name, username, avatar_url, avatar_path")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setProfile((prof as any) ?? null);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ✅ تحميل صورة الأفاتار بنفس منطق PostCard
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const p: any = profile ?? {};
        const raw =
          (p.avatar_path as string | null) ??
          (p.avatar_url as string | null) ??
          "";

        const v = (raw || "").trim();
        if (!v) {
          if (alive) setAvatarUrl("");
          return;
        }

        // لو رابط جاهز (خارجي أو يبدأ بـ /)
        if (
          v.startsWith("http://") ||
          v.startsWith("https://") ||
          v.startsWith("/")
        ) {
          if (alive) setAvatarUrl(v);
          return;
        }

        // مسار داخل bucket avatars
        const { data, error } = await supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(v, 60 * 60);

        if (error) {
          console.error("NewPostComposer avatar signedUrl error", error);
          if (alive) setAvatarUrl("");
          return;
        }

        const url = data?.signedUrl ?? "";
        if (!alive) return;
        setAvatarUrl(
          url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : ""
        );
      } catch (e) {
        console.error("NewPostComposer avatar load error", e);
        if (alive) setAvatarUrl("");
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile]);

  // ✅ توحيد الاسم والاختصار
  const displayName = useMemo(() => getDisplayName(profile as any), [profile]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const canPost = useMemo(() => {
    const hasText = content.trim().length > 0;
    const hasMedia = selectedFiles.length > 0 || isUrlLike(videoUrl);
    return !loading && (hasText || hasMedia);
  }, [content, selectedFiles.length, videoUrl, loading]);

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

  function promptVideoUrl() {
    const current = videoUrl.trim();
    const p = window.prompt(
      "ضع رابط فيديو (YouTube / TikTok / Instagram / ...):",
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

      const v = videoUrl.trim();
      const videoUrls = isUrlLike(v) ? [v] : [];

      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: content.trim() ? content.trim() : null,
        image_paths: mediaUrls.length ? mediaUrls : [],
        video_urls: videoUrls.length ? videoUrls : [],
        is_retweet: false,
        original_post_id: null,
        view_count: 0,
      });

      if (error) throw new Error(error.message);

      previewImages.forEach((u) => URL.revokeObjectURL(u));
      setContent("");
      setSelectedFiles([]);
      setPreviewImages([]);
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
     معاينة يوتيوب فقط
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
        {/* ✅ أفاتار على اليمين (نفس منطق PostCard) */}
        <div className="shrink-0">
          {avatarUrl ? (
            <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={displayName}
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

      {/* ✅ معاينة YouTube */}
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
            <Video className="h-4 w-4" />
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
          <Video className="h-4 w-4" />
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
          <button
            type="button"
            onClick={() => {
              const v = window.prompt("ضع رابط (اختياري):");
              if (v !== null) window.prompt("انسخ/عدّل الرابط:", v);
            }}
            className="hover:text-slate-900 transition"
            title="رابط"
          >
            <Link2 className="h-5 w-5" />
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

          <button
            type="button"
            onClick={promptVideoUrl}
            className="hover:text-slate-900 transition"
            title="إرفاق رابط فيديو"
          >
            <Video className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handlePost}
          disabled={!canPost}
          className="ms-auto rounded-full px-5 py-2 text-sm font-semibold bg-slate-900 text-white disabled:opacity-50"
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

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFilesChosen(e.target.files)}
      />
    </div>
  );
}
