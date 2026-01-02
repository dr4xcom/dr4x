// src/app/messages/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type RawConversation = {
  [key: string]: any;
};

type ConversationRow = {
  conversationId: string;
  otherName: string;
  lastBody: string;
  lastAt: string | null;
  hasUnread: boolean;
};

function formatDateTime(val?: string | null) {
  if (!val) return "";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function MessagesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<ConversationRow[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // تأكد أن المستخدم مسجل دخول
        const { data: sData, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;

        const uid = sData?.session?.user?.id ?? null;
        if (!uid) {
          router.push("/auth/login");
          return;
        }
        if (!alive) return;

        // استدعاء قائمة المحادثات
        const { data, error } = await supabase.rpc(
          "user_list_dm_conversations",
          {
            p_limit: 50,
            p_offset: 0,
          }
        );

        if (error) {
          console.error("user_list_dm_conversations error", error);
          setErr(
            error.message ||
              "تعذر تحميل قائمة المحادثات. حاول مرة أخرى لاحقًا."
          );
          setLoading(false);
          return;
        }

        if (!alive) return;

        const list = Array.isArray(data) ? (data as RawConversation[]) : [];

        const mapped: ConversationRow[] = list.map((o) => {
          // رقم المحادثة من أي اسم محتمل
          const conversationId: string =
            o.conversation_id || o.id || o.conv_id || "";

          // اسم العضو الآخر (نحاول أكثر من حقل تحسبًا لاختلاف الأسماء في SQL)
          const otherName: string =
            o.other_display_name ||
            o.other_full_name ||
            o.other_username ||
            o.other_email ||
            o.other_name ||
            "محادثة خاصة";

          // نص آخر رسالة
          const lastBody: string =
            o.last_message_body ||
            o.last_msg_body ||
            o.last_body ||
            o.last_message ||
            "";

          // وقت آخر رسالة
          const lastAt: string | null =
            o.last_message_at ||
            o.last_msg_at ||
            o.last_message_time ||
            o.updated_at ||
            o.created_at ||
            null;

          // هل فيها رسائل غير مقروءة
          const hasUnread: boolean =
            (typeof o.unread_count === "number" && o.unread_count > 0) ||
            !!o.has_unread ||
            !!o.is_unread;

          return {
            conversationId,
            otherName,
            lastBody,
            lastAt,
            hasUnread,
          };
        });

        setRows(mapped);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error("messages page load error", e);
        setErr(e?.message ?? "تعذر تحميل الرسائل الخاصة.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl rounded-[32px] border border-slate-800 bg-slate-950/80 p-6 space-y-6">
        {/* العنوان */}
        <div className="text-right space-y-1">
          <h1 className="text-2xl font-extrabold">الرسائل الخاصة</h1>
          <p className="text-sm text-slate-300">
            هنا تظهر المحادثات الخاصة بينك وبين الأعضاء.
          </p>
        </div>

        {/* رسالة خطأ إن وجدت */}
        {err ? (
          <div className="rounded-2xl border border-red-500 bg-red-900/40 px-4 py-3 text-sm">
            {err}
          </div>
        ) : null}

        {/* قائمة المحادثات */}
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 px-4 py-4 space-y-3">
          {loading ? (
            <div className="text-sm text-slate-400 text-center">
              جاري تحميل المحادثات…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-4">
              لا توجد محادثات خاصة بعد.
            </div>
          ) : (
            rows.map((row) => {
              const preview =
                row.lastBody?.trim() || "لا توجد رسائل في هذه المحادثة بعد.";
              const timeText = formatDateTime(row.lastAt);

              return (
                <button
                  key={row.conversationId}
                  type="button"
                  onClick={() => {
                    if (!row.conversationId) return;
                    router.push(`/messages/${row.conversationId}`);
                  }}
                  className="w-full flex items-center justify-between gap-3 rounded-3xl border border-emerald-500/50 bg-slate-900/80 px-4 py-3 text-right hover:bg-slate-900 transition"
                >
                  {/* النص الرئيسي (يمين) */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm sm:text-base truncate">
                        {row.otherName}
                      </span>
                      {timeText ? (
                        <span className="text-[10px] sm:text-xs text-slate-400 whitespace-nowrap ms-2">
                          {timeText}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-200 truncate">
                      {preview}
                    </div>
                  </div>

                  {/* نقطة حالة القراءة */}
                  <div
                    className={[
                      "h-3 w-3 rounded-full flex-shrink-0",
                      row.hasUnread
                        ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                        : "border border-emerald-500",
                    ].join(" ")}
                  />
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="rounded-full px-8 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold"
          >
            الرجوع إلى الصفحة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
