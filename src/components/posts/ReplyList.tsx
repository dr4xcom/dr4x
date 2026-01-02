// src/components/posts/ReplyList.tsx
"use client";

import React from "react";
import ReplyComposer from "@/components/posts/ReplyComposer";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  ProfileMini,
  ReplyRow,
  extractYouTubeId,
  formatTime,
  getAvatarUrl,
  getDisplayName,
  getHandle,
  getInitials,
  isProbablyYouTube,
  isVerified,
} from "@/lib/postsFeed/utils";

// نفس البكت المستخدم للأفاتار في باقي المشروع
const AVATAR_BUCKET = "avatars";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

/**
 * يحوّل القيمة القادمة من getAvatarUrl إلى رابط صالح للمتصفح:
 * - لو بدأت بـ http/https أو / → نستخدمها كما هي
 * - لو كانت مجرد مسار مثل "uuid/avatar.jpg" → نبني رابط Supabase public
 * - لو مافي URL أو مافي SUPABASE_URL → نرجّع ""
 */
function resolveAvatarUrl(raw?: string | null): string {
  const v = (raw || "").trim();
  if (!v) return "";

  // رابط جاهز (خارجي أو من /public)
  if (
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("/")
  ) {
    return v;
  }

  // مسار داخل البكت avatars (Supabase public bucket)
  if (!SUPABASE_URL) return "";

  const base = SUPABASE_URL.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${v}`;
}

export default function ReplyList({
  postId,
  isOpen,
  replies,
  profilesById,
  meId,
  loadingRepliesFor,
  replyMenuOpen,
  setReplyMenuOpen,
  onCancelReply,
  onAfterPosted,
  onLoadReplies,
  onEditReply,
  onDeleteReply,
  openLightbox,
}: {
  postId: number;
  isOpen: boolean;
  replies: ReplyRow[];
  profilesById: Record<string, ProfileMini>;
  meId: string | null;
  loadingRepliesFor: number | null;
  replyMenuOpen: Record<number, boolean>;
  setReplyMenuOpen: React.Dispatch<
    React.SetStateAction<Record<number, boolean>>
  >;
  onCancelReply: () => void;
  onAfterPosted: () => Promise<void>;
  onLoadReplies: (postId: number) => Promise<void>;
  onEditReply: (replyId: number, postId: number, current: string | null) => void;
  onDeleteReply: (replyId: number, postId: number) => void;
  openLightbox: (images: string[], index: number) => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      <ReplyComposer
        postId={postId}
        onCancel={onCancelReply}
        onPosted={async () => {
          await onAfterPosted();
          // اختيارية: إعادة تحميل الردود لو حبيت
          // await onLoadReplies(postId);
        }}
      />

      {loadingRepliesFor === postId ? (
        <div className="text-xs text-slate-500">جاري تحميل الردود...</div>
      ) : null}

      {replies.length > 0 ? (
        <div className="mt-3 space-y-2">
          {replies.map((r) => {
            const rp = profilesById[r.user_id];
            const rName = getDisplayName(rp);
            const rHandle = getHandle(rp);
            const rVerified = isVerified(rp);

            // نحصل على المسار من util القديم
            const rawAvatar = getAvatarUrl(rp as any);
            // ونحوّله إلى رابط صالح
            const rAvatarUrl = resolveAvatarUrl(rawAvatar);
            const rInitials = getInitials(rName);

            const isMyReply = !!meId && r.user_id === meId;

            const replyYt =
              r.youtube_url && isProbablyYouTube(r.youtube_url)
                ? extractYouTubeId(r.youtube_url)
                : null;

            return (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {rAvatarUrl ? (
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-white">
                      {/* نستخدم img العادي لتجنب مشاكل next/image مع الروابط النسبية */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={rAvatarUrl}
                        alt={rName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-bold">
                      {rInitials}
                    </div>
                  )}

                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {rName}
                  </div>

                  {rHandle ? (
                    <div className="text-xs text-slate-500 truncate">
                      {rHandle}
                      {rVerified ? " ✓" : ""}
                    </div>
                  ) : null}

                  <div className="text-xs text-slate-400 truncate ms-auto">
                    {formatTime(r.created_at)}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setReplyMenuOpen((prev) => ({
                          ...prev,
                          [r.id]: !prev[r.id],
                        }))
                      }
                      className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
                      title="المزيد"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {replyMenuOpen[r.id] ? (
                      <div className="absolute z-20 mt-2 left-0 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                        <button
                          type="button"
                          className="w-full inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setReplyMenuOpen((prev) => ({
                              ...prev,
                              [r.id]: false,
                            }));
                            if (!isMyReply) return alert("غير مسموح");
                            void onEditReply(r.id, postId, r.content);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          <span>تعديل</span>
                        </button>

                        <button
                          type="button"
                          className="w-full inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setReplyMenuOpen((prev) => ({
                              ...prev,
                              [r.id]: false,
                            }));
                            if (!isMyReply) return alert("غير مسموح");
                            void onDeleteReply(r.id, postId);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>حذف</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-800 break-anywhere whitespace-pre-wrap">
                  {r.content?.trim() ? r.content : ""}
                </div>

                {Array.isArray(r.image_urls) && r.image_urls.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.image_urls.map((src, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => openLightbox(r.image_urls || [], idx)}
                        className="relative w-[160px] h-[90px] rounded-xl overflow-hidden bg-slate-100"
                        title="عرض الصورة"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt="reply"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                {replyYt ? (
                  <div className="mt-2 w-full h-[240px] rounded-xl overflow-hidden bg-black">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${replyYt}`}
                      allowFullScreen
                      title={`Reply YouTube ${replyYt}`}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-500">لا توجد ردود بعد.</div>
      )}
    </>
  );
}
