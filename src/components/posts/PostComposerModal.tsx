"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Image as ImageIcon, Smile, Link2, Video } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

type ProfileLite = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
};

const STORAGE_BUCKET = "post_media"; // ✅ تم التعديل حسب Bucket الموجود عندك في Supabase

function extractYouTubeId(url: string): string | null {
  const u = url.trim();
  if (!u) return null;

  const m1 = u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m1?.[1]) return m1[1];

  const m2 = u.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m2?.[1]) return m2[1];

  const m3 = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (m3?.[1]) return m3[1];

  const m4 = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (m4?.[1]) return m4[1];

  return null;
}

function safeExtFromName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  return (ext || "").toLowerCase();
}

function guessExt(file: File) {
  const byName = safeExtFromName(file.name);
  if (byName) return byName;
  const byType = (file.type || "").split("/")[1] || "";
  return (byType || "bin").toLowerCase();
}

export default function PostComposerModal({
  open,
  onClose,
  children,
  onPostCreated,
}: {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  onPostCreated?: () => void;
}) {
  const [profile, setProfile] = useState<ProfileLite>({
    full_name: null,
    username: null,
    avatar_url: null,
    email: null,
  });

  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);

  const [images, setImages] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // ✅ معاينات ثابتة بدل URL.createObjectURL داخل JSX
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const imagesInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const youtubeId = useMemo(() => extractYouTubeId(youtubeUrl), [youtubeUrl]);

  const displayName = useMemo(() => {
    const pName = profile.full_name?.trim();
    const pUser = profile.username?.trim();
    const em = profile.email?.trim();
    return pName || pUser || (em ? em.split("@")[0] : "") || "مستخدم";
  }, [profile.full_name, profile.username, profile.email]);

  const handle = useMemo(() => {
    const u = profile.username?.trim();
    const em = profile.email?.trim();
    return u || (em ? em.split("@")[0] : "");
  }, [profile.username, profile.email]);

  const initials = useMemo(() => {
    const s = displayName.trim();
    const a = s[0] ?? "D";
    const b = s[1] ?? "R";
    return (a + b).toUpperCase();
  }, [displayName]);

  useEffect(() => {
    if (!open) return;

    setErrorMsg(null);
    setPublishing(false);
    setShowEmoji(false);

    setTimeout(() => textareaRef.current?.focus(), 0);

    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setProfile({
          full_name: null,
          username: null,
          avatar_url: null,
          email: null,
        });
        return;
      }

      const email = user.email ?? null;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const metaName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        null;

      setProfile({
        full_name: (data?.full_name as string | null) ?? metaName ?? null,
        username: (data?.username as string | null) ?? null,
        avatar_url: (data?.avatar_url as string | null) ?? null,
        email,
      });
    })();

    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 🔒 لما المودال يفتح نوقف تمرير الخلفية
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ✅ بناء/تنظيف معاينات الصور عند تغيّر images
  useEffect(() => {
    imagePreviews.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    });

    const next = images.map((f) => URL.createObjectURL(f));
    setImagePreviews(next);

    return () => {
      next.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  // ✅ بناء/تنظيف معاينة الفيديو
  useEffect(() => {
    if (videoPreview) {
      try {
        URL.revokeObjectURL(videoPreview);
      } catch {}
    }

    if (!videoFile) {
      setVideoPreview(null);
      return;
    }

    const u = URL.createObjectURL(videoFile);
    setVideoPreview(u);

    return () => {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoFile]);

  function appendEmoji(emoji: string) {
    setContent((v) => v + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }

  function onPickImages(files: FileList | null) {
    if (!files || files.length === 0) return;

    const picked = Array.from(files).filter(
      (f) => f && f.type.startsWith("image/")
    );
    if (picked.length === 0) return;

    setImages((prev) => [...prev, ...picked]);

    if (imagesInputRef.current) imagesInputRef.current.value = "";
  }

  function onPickVideo(files: FileList | null) {
    const f = files?.[0] ?? null;
    if (f && !f.type.startsWith("video/")) return;

    setVideoFile(f);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function resetComposer() {
    setContent("");
    setYoutubeUrl("");
    setShowEmoji(false);
    setImages([]);
    setVideoFile(null);
    setErrorMsg(null);
  }

  async function uploadToStorage(userId: string, file: File, folder: string) {
    const ext = guessExt(file);
    const path = `${folder}/${userId}/${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.${ext}`;

    const up = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });

    if (up.error) {
      throw new Error(up.error.message || "Storage upload failed");
    }

    const pub = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    const publicUrl = pub?.data?.publicUrl || "";

    return {
      path,
      publicUrl,
    };
  }

  async function handlePublish() {
    if (publishing) return;

    setErrorMsg(null);

    const text = content.trim();
    const yt = youtubeUrl.trim();
    const hasSomething = !!text || !!yt || images.length > 0 || !!videoFile;
    if (!hasSomething) return;

    setPublishing(true);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setErrorMsg("يجب تسجيل الدخول أولاً");
        setPublishing(false);
        return;
      }

      const uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        for (const img of images) {
          const { publicUrl, path } = await uploadToStorage(user.id, img, "images");
          uploadedImageUrls.push(publicUrl || path);
        }
      }

      let uploadedVideoUrl: string | null = null;
      if (videoFile) {
        const { publicUrl, path } = await uploadToStorage(user.id, videoFile, "videos");
        uploadedVideoUrl = publicUrl || path;
      }

      const videoUrls: string[] = [];
      if (yt) videoUrls.push(yt);
      if (uploadedVideoUrl) videoUrls.push(uploadedVideoUrl);

      const richPayload: Record<string, any> = {
        author_id: user.id,
        content: text,
        image_paths: uploadedImageUrls,
        video_urls: videoUrls,
        is_retweet: false,
        original_post_id: null,
        view_count: 0,
      };

      let res = await supabase.from("posts").insert(richPayload);

      if (res.error) {
        const msg = String(res.error.message || "").toLowerCase();

        if (msg.includes("author_id")) {
          const richPayload2 = { ...richPayload };
          delete richPayload2.author_id;
          richPayload2.profile_id = user.id;
          res = await supabase.from("posts").insert(richPayload2);
        }

        if (res.error) {
          const simplePayloadA: Record<string, any> = {
            content: yt && text ? `${text}\n\n${yt}` : yt || text,
            author_id: user.id,
          };

          let res2 = await supabase.from("posts").insert(simplePayloadA);

          if (res2.error) {
            const msg2 = String(res2.error.message || "").toLowerCase();
            if (msg2.includes("author_id")) {
              const simplePayloadB: Record<string, any> = {
                content: yt && text ? `${text}\n\n${yt}` : yt || text,
                profile_id: user.id,
              };
              res2 = await supabase.from("posts").insert(simplePayloadB);
            }
          }

          if (res2.error) {
            console.error("PUBLISH ERROR:", res2.error);
            setErrorMsg("حدث خطأ أثناء النشر.");
            setPublishing(false);
            return;
          }
        }
      }

      resetComposer();
      onPostCreated?.();
      onClose();
    } catch (e: any) {
      console.error("UNEXPECTED:", e);
      setErrorMsg(e?.message ? String(e.message) : "حدث خطأ غير متوقع.");
    } finally {
      setPublishing(false);
    }
  }

  const disabledPublish =
    publishing ||
    (!content.trim() && !youtubeUrl.trim() && images.length === 0 && !videoFile);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2 sm:px-4">
      {/* خلفية المودال */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      {/* ✅ هنا التعديل المهم: عرض مرن + ارتفاع مرن للجوال والكمبيوتر */}
      <div className="relative w-full max-w-[750px] max-h-[90vh] dr4x-card bg-white overflow-hidden flex flex-col">
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0"
          dir="ltr"
        >
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition"
            aria-label="إغلاق"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="text-sm font-semibold" dir="rtl">
            نشر
          </div>

          <div className="w-10" />
        </div>

        {children ? (
          <div className="min-h-0 overflow-y-auto">{children}</div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto bg-white" dir="rtl">
            <div className="p-4">
              <div className="flex items-start gap-3">
                {profile.avatar_url ? (
                  <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-bold shrink-0">
                    {initials}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {displayName}
                    </div>
                    {handle ? (
                      <div className="text-sm text-slate-500 truncate" dir="ltr">
                        @{handle}
                      </div>
                    ) : null}
                  </div>

                  <textarea
                    ref={textareaRef}
                    dir="rtl"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="ماذا يحدث؟"
                    className="w-full resize-none outline-none text-sm placeholder:text-slate-400 min-h-[80px] mt-2"
                  />

                  {errorMsg ? (
                    <div className="mt-2 text-sm text-red-600">{errorMsg}</div>
                  ) : null}

                  {images.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {images.map((file, i) => (
                        <div
                          key={i}
                          className="relative w-[160px] h-[90px] rounded-xl overflow-hidden bg-slate-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagePreviews[i] || ""}
                            className="w-full h-full object-cover"
                            alt="preview"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setImages((v) => v.filter((_, idx) => idx !== i))
                            }
                            className="absolute top-1 end-1 bg-black/60 text-white rounded-full p-1"
                            aria-label="إزالة الصورة"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {videoFile ? (
                    <div className="mt-3 relative w-full max-w-[320px] h-[180px] rounded-xl overflow-hidden bg-black">
                      <video
                        controls
                        src={videoPreview || ""}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setVideoFile(null)}
                        className="absolute top-1 end-1 bg-black/60 text-white rounded-full p-1"
                        aria-label="إزالة الفيديو"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                      <Link2 className="h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="رابط يوتيوب"
                        className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400"
                        dir="ltr"
                      />
                      {youtubeUrl ? (
                        <button
                          type="button"
                          onClick={() => setYoutubeUrl("")}
                          className="text-slate-500 hover:text-slate-700"
                          aria-label="مسح رابط يوتيوب"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>

                    {youtubeId ? (
                      <div className="mt-3 w-full max-w-[320px] h-[180px] rounded-xl overflow-hidden bg-black">
                        <iframe
                          className="w-full h-full"
                          src={`https://www.youtube.com/embed/${youtubeId}`}
                          allowFullScreen
                          title="YouTube Preview"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 relative">
                    <div className="flex items-center gap-2 text-slate-500">
                      <button
                        type="button"
                        className="p-2 rounded-full hover:bg-slate-100 transition"
                        onClick={() => imagesInputRef.current?.click()}
                        aria-label="إضافة صور"
                      >
                        <ImageIcon className="h-5 w-5" />
                      </button>
                      <input
                        ref={imagesInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        hidden
                        onChange={(e) => onPickImages(e.target.files)}
                      />

                      <button
                        type="button"
                        className="p-2 rounded-full hover:bg-slate-100 transition"
                        onClick={() => videoInputRef.current?.click()}
                        aria-label="إضافة فيديو"
                      >
                        <Video className="h-5 w-5" />
                      </button>
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        hidden
                        onChange={(e) => onPickVideo(e.target.files)}
                      />

                      <button
                        type="button"
                        className="p-2 rounded-full hover:bg-slate-100 transition"
                        onClick={() => setShowEmoji((v) => !v)}
                        aria-label="إيموجي"
                      >
                        <Smile className="h-5 w-5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:opacity-95 transition disabled:opacity-50"
                      onClick={handlePublish}
                      disabled={disabledPublish}
                    >
                      {publishing ? "جارٍ النشر..." : "نشر"}
                    </button>

                    {showEmoji ? (
                      <div className="absolute end-0 top-[-10px] translate-y-[-100%] w-full max-w-md border border-slate-200 rounded-2xl p-3 bg-white shadow-lg">
                        <div className="grid grid-cols-8 gap-2 text-lg">
                          {[
                            "😀","😁","😂","🤣","😊","😍","😘","😎",
                            "😢","😭","😡","👍","👎","🙏","💙","🔥",
                            "✨","🎉","💯","✅","⚕️","🩺","🧠","💊",
                          ].map((e) => (
                            <button
                              key={e}
                              type="button"
                              className="hover:bg-slate-100 rounded-lg"
                              onClick={() => appendEmoji(e)}
                              aria-label={`emoji ${e}`}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="h-6" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
