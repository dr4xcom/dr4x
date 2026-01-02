// src/app/messages/[id]/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type DMMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean;
};

type MemberRow = {
  user_id: string;
};

type ProfileRow = {
  full_name: string | null;
  username: string | null;
};

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const conversationId = (params?.id ?? "").toString();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const [otherDisplayName, setOtherDisplayName] = useState<string>("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // تحميل الرسائل + اسم الطرف الآخر + تعليم المحادثة كمقروءة
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const { data: sData, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;
        const uid = sData?.session?.user?.id ?? null;
        if (!uid) {
          router.push("/auth/login");
          return;
        }
        if (!alive) return;
        setMeId(uid);

        if (!conversationId) {
          setErr("معرّف المحادثة غير صالح.");
          setLoading(false);
          return;
        }

        // 1) تحميل الرسائل
        const { data, error } = await supabase.rpc("dm_list_messages", {
          p_conversation_id: conversationId,
          p_limit: 100,
          p_offset: 0,
        });

        if (error) {
          console.error("dm_list_messages error", error);
          setErr(
            error.message ||
              "تعذر تحميل الرسائل. قد لا تكون عضوًا في هذه المحادثة."
          );
          setLoading(false);
          return;
        }

        if (!alive) return;
        setMessages((data as DMMessage[]) || []);

        // 2) جلب اسم الطرف الآخر في المحادثة (عضو واحد غيري)
        const { data: memRows, error: memErr } = await supabase
          .from("dm_members")
          .select("user_id")
          .eq("conversation_id", conversationId);

        if (memErr) {
          console.error("dm_members load error", memErr);
        } else if (memRows && Array.isArray(memRows)) {
          const others = (memRows as MemberRow[]).filter(
            (m) => m.user_id !== uid
          );
          const otherId = others[0]?.user_id ?? null;
          if (otherId) {
            const { data: prof, error: profErr } = await supabase
              .from("profiles")
              .select("full_name, username")
              .eq("id", otherId)
              .maybeSingle();

            if (profErr) {
              console.error("other profile load error", profErr);
            } else if (prof) {
              const p = prof as ProfileRow;
              const disp =
                (p.full_name ?? "").trim() ||
                (p.username ?? "").trim() ||
                "عضو";
              if (alive) setOtherDisplayName(disp);
            }
          }
        }

        // 3) تعليم المحادثة كمقروءة (لتصفير الشعار في الهوم)
        await supabase.rpc("user_mark_dm_read", {
          p_conversation_id: conversationId,
        });

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error("conversation load error", e);
        setErr(e?.message ?? "تعذر تحميل المحادثة.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [conversationId, router]);

  // إرسال رسالة جديدة
  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!body.trim() || !conversationId || sending) return;

    try {
      setSending(true);
      setErr("");

      const { error } = await supabase.rpc("dm_send_message", {
        p_conversation_id: conversationId,
        p_body: body.trim(),
      });

      if (error) {
        console.error("dm_send_message error", error);
        setErr(error.message || "تعذر إرسال الرسالة.");
        setSending(false);
        return;
      }

      setBody("");

      const { data: data2, error: err2 } = await supabase.rpc(
        "dm_list_messages",
        {
          p_conversation_id: conversationId,
          p_limit: 100,
          p_offset: 0,
        }
      );

      if (err2) {
        console.error("dm_list_messages after send error", err2);
      } else {
        setMessages((data2 as DMMessage[]) || []);
      }

      await supabase.rpc("user_mark_dm_read", {
        p_conversation_id: conversationId,
      });
    } catch (x: any) {
      console.error("send message unexpected error", x);
      setErr(x?.message ?? "حدث خطأ غير متوقع.");
    } finally {
      setSending(false);
    }
  }

  // حذف رسالة (يتأكد أولاً أن الميزة مفعّلة في system_settings)
  async function handleDeleteMessage(messageId: string) {
    if (!messageId) return;
    if (!window.confirm("هل تريد حذف هذه الرسالة؟")) return;

    try {
      // 1) نقرأ إعداد الميزة من system_settings
      const { data: settingsRow, error: settingsErr } = await supabase
        .from("system_settings")
        .select("feature_flags")
        .single();

      if (settingsErr) {
        console.error("system_settings error", settingsErr);
      }

      const allow =
        (settingsRow as any)?.feature_flags?.allow_dm_delete === true;

      if (!allow) {
        alert("حذف الرسائل غير مفعّل حالياً من لوحة الإدارة.");
        return;
      }

      // 2) نستدعي الدالة المخزنة التي فيها منطق الصلاحيات
      const { error } = await supabase.rpc("dm_delete_message", {
        p_message_id: messageId,
      });

      if (error) {
        console.error("dm_delete_message error", error);
        alert(error.message || "تعذر حذف الرسالة.");
        return;
      }

      // 3) إعادة تحميل الرسائل بعد الحذف
      const { data: data2, error: err2 } = await supabase.rpc(
        "dm_list_messages",
        {
          p_conversation_id: conversationId,
          p_limit: 100,
          p_offset: 0,
        }
      );

      if (err2) {
        console.error("dm_list_messages after delete error", err2);
      } else {
        setMessages((data2 as DMMessage[]) || []);
      }

      await supabase.rpc("user_mark_dm_read", {
        p_conversation_id: conversationId,
      });
    } catch (e: any) {
      console.error("delete message unexpected error", e);
      alert(e?.message ?? "حدث خطأ غير متوقع أثناء الحذف.");
    }
  }

  const headerTitle = otherDisplayName
    ? `محادثة مع ${otherDisplayName}`
    : `محادثة خاصة • ID: ${conversationId.slice(0, 8)}…`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col px-4 py-4">
        {/* الهيدر */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full px-4 py-2 bg-slate-900 text-slate-100 border border-slate-700 hover:bg-slate-800 text-sm"
          >
            الرجوع
          </button>
          <div className="text-sm text-slate-200 font-semibold text-right">
            {headerTitle}
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-500 bg-red-900/40 p-3 text-sm mb-3">
            {err}
          </div>
        ) : null}

        {/* الرسائل */}
        <div className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              جاري تحميل الرسائل…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              لا توجد رسائل بعد. ابدأ المحادثة 👋
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const mine = meId && m.sender_id === meId;
                const senderLabel = mine
                  ? "أنت"
                  : otherDisplayName || "المرسل";

                return (
                  <div
                    key={m.id}
                    className={[
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "ml-auto bg-emerald-500 text-slate-900"
                        : "mr-auto bg-slate-800 text-slate-100 border border-slate-700",
                    ].join(" ")}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {m.is_deleted ? "تم حذف هذه الرسالة" : m.body}
                    </div>
                    <div
                      className={[
                        "mt-1 text-[10px]",
                        mine ? "text-emerald-900/80" : "text-slate-400",
                      ].join(" ")}
                    >
                      {senderLabel} •{" "}
                      {new Date(m.created_at).toLocaleString()}
                    </div>

                    {mine && !m.is_deleted && (
                      <div className="mt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(m.id)}
                          className="text-[10px] underline-offset-2 underline hover:no-underline"
                        >
                          حذف الرسالة
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* إدخال رسالة جديدة */}
        <form
          onSubmit={handleSend}
          className="mt-4 flex items-center gap-2 rounded-3xl border border-slate-800 bg-slate-900 px-3 py-2"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="flex-1 bg-transparent border-none outline-none text-sm resize-none"
            placeholder="اكتب رسالتك هنا…"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-2xl px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold disabled:opacity-60"
          >
            {sending ? "جارٍ الإرسال…" : "إرسال"}
          </button>
        </form>
      </div>
    </div>
  );
}
