// src/components/clinic/ConsultationChat.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/utils/supabase/client";
import { Send, Paperclip, Loader2, Trash2 } from "lucide-react";

type ChatRole = "doctor" | "patient";

type ChatMessage = {
  id: string;
  queue_id: string;
  sender_role: ChatRole;
  sender_id: string;
  text: string;
  created_at: string;
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function ConsultationChat({
  queueId,
  role,
  disabled,
  className,
}: {
  queueId: string | null;
  role: ChatRole;
  disabled?: boolean;
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [text, setText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  const isDoctor = role === "doctor";

  const title = isDoctor
    ? "المحادثة النصية مع المريض"
    : "المحادثة النصية مع الطبيب";

  const effectiveDisabled = !queueId || disabled;

  // تحميل الرسائل + Realtime
  useEffect(() => {
    let alive = true;
    let channel: any = null;

    async function loadAndSubscribe(currentQueueId: string) {
      try {
        setLoading(true);
        setErrorMsg(null);

        const { data, error } = await supabase
          .from("consultation_messages")
          .select(
            "id, queue_id, sender_role, sender_id, text, created_at"
          )
          .eq("queue_id", currentQueueId)
          .order("created_at", { ascending: true });

        if (!alive) return;

        if (error) {
          console.error("load messages error", error);
          setErrorMsg("تعذّر تحميل رسائل المحادثة.");
        } else {
          setMessages((data || []) as ChatMessage[]);
        }
      } catch (e: any) {
        if (!alive) return;
        console.error("load messages unexpected", e);
        setErrorMsg(e?.message ?? "خطأ غير متوقع أثناء تحميل الشات.");
      } finally {
        if (alive) setLoading(false);
      }

      // اشتراك Realtime
      channel = supabase
        .channel(`consultation_messages_${currentQueueId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "consultation_messages",
            filter: `queue_id=eq.${currentQueueId}`,
          },
          (payload) => {
            const row = payload.new as ChatMessage;
            if (!row) return;
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              const next = [...prev, row];
              next.sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime()
              );
              return next;
            });
          }
        )
        .subscribe();
    }

    if (!queueId) {
      setMessages([]);
      setErrorMsg(null);
      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }

    loadAndSubscribe(queueId);

    return () => {
      alive = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queueId]);

  // سكروول لآخر رسالة
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (effectiveDisabled) return;
    const trimmed = text.trim();
    if (!trimmed || !queueId) return;

    try {
      setSending(true);
      setErrorMsg(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        setErrorMsg("يجب تسجيل الدخول لإرسال الرسائل.");
        setSending(false);
        return;
      }

      const userId = authData.user.id;

      const { error: insertErr } = await supabase
        .from("consultation_messages")
        .insert({
          queue_id: queueId,
          sender_role: role,
          sender_id: userId,
          text: trimmed,
        });

      if (insertErr) {
        console.error("insert message error", insertErr);
        setErrorMsg("تعذّر إرسال الرسالة، حاول مرة أخرى.");
        return;
      }

      setText("");
    } catch (e: any) {
      console.error("send message unexpected", e);
      setErrorMsg(e?.message ?? "حدث خطأ أثناء إرسال الرسالة.");
    } finally {
      setSending(false);
    }
  }, [effectiveDisabled, queueId, role, text]);

  const handleClear = useCallback(async () => {
    if (!queueId) return;
    if (!window.confirm("هل أنت متأكد من مسح جميع رسائل هذه الجلسة؟")) return;

    try {
      setClearing(true);
      setErrorMsg(null);

      const { error } = await supabase
        .from("consultation_messages")
        .delete()
        .eq("queue_id", queueId);

      if (error) {
        console.error("clear messages error", error);
        setErrorMsg("تعذّر مسح الرسائل، حاول مرة أخرى.");
        return;
      }

      setMessages([]);
    } catch (e: any) {
      console.error("clear messages unexpected", e);
      setErrorMsg(e?.message ?? "حدث خطأ أثناء مسح الرسائل.");
    } finally {
      setClearing(false);
    }
  }, [queueId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const disabledReason = useMemo(() => {
    if (!queueId) {
      return isDoctor
        ? "الشات ينتظر اختيار مريض من قائمة الانتظار…"
        : "ابدأ الجلسة مع الطبيب أولاً لتفعيل الشات…";
    }
    if (disabled) {
      return "تم إيقاف الشات مؤقتاً من لوحة التحكم.";
    }
    return null;
  }, [queueId, disabled, isDoctor]);

  return (
    <div
      className={classNames(
        "w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-3 sm:px-4 py-3 flex flex-col gap-2",
        "min-height-[220px] max-h-80 overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs sm:text-sm font-semibold text-slate-100">
          {title}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-slate-500">
            الرسائل تظهر فوراً بين الطرفين.
          </div>
          {/* زر مسح الرسائل للطبيب والمريض معاً */}
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={!queueId || clearing}
            className={classNames(
              "inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[10px]",
              !queueId || clearing
                ? "border-slate-700 text-slate-500 bg-slate-900/50 cursor-not-allowed"
                : "border-rose-500/60 text-rose-200 bg-rose-950/40 hover:bg-rose-900/60"
            )}
          >
            <Trash2 className="h-3 w-3" />
            <span>مسح رسائل الجلسة</span>
          </button>
        </div>
      </div>

      {/* صندوق الرسائل */}
      <div
        ref={listRef}
        className="flex-1 min-h-[120px] max-h-[180px] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950/95 px-3 py-2 space-y-2"
      >
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>جارٍ تحميل المحادثة…</span>
          </div>
        ) : null}

        {!loading && messages.length === 0 && !errorMsg && (
          <div className="text-[11px] text-slate-500 text-center">
            لا توجد رسائل بعد، ابدأ بكتابة أول رسالة لبدء المحادثة.
          </div>
        )}

        {errorMsg && (
          <div className="text-[11px] text-red-300 text-center">
            {errorMsg}
          </div>
        )}

        {messages.map((m) => {
          const isMine = m.sender_role === role;
          return (
            <div
              key={m.id}
              className={classNames(
                "flex w-full",
                isMine ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={classNames(
                  // ✅ هنا الحل: منع تمدد الصفحة بسطر واحد طويل
                  "max-w-full sm:max-w-[80%] rounded-2xl px-3 py-2 text-[11px] sm:text-xs whitespace-pre-wrap break-all shadow",
                  isMine
                    ? "bg-emerald-500 text-emerald-950 rounded-br-sm"
                    : "bg-slate-800 text-slate-100 rounded-bl-sm"
                )}
              >
                <div className="mb-0.5 text-[9px] text-slate-900/70 opacity-80">
                  {m.sender_role === "doctor" ? "الطبيب" : "المريض"}
                </div>
                <div>{m.text}</div>
                <div className="mt-1 text-[9px] text-slate-900/60 text-left ltr:text-right">
                  {new Date(m.created_at).toLocaleTimeString("ar-SA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* رسالة توضيح إذا الشات مقفول */}
      {disabledReason && (
        <div className="text-[11px] text-amber-300/90 mt-1">
          {disabledReason}
        </div>
      )}

      {/* حقل الكتابة + الإرسال + زر الملفات */}
      <div className="mt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <button
          type="button"
          disabled={effectiveDisabled}
          className={classNames(
            "inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-[11px] sm:text-xs font-semibold",
            effectiveDisabled
              ? "border-slate-700 text-slate-500 bg-slate-900/70 cursor-not-allowed"
              : "border-emerald-500/70 text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20"
          )}
          onClick={() => {
            if (!effectiveDisabled) {
              alert(
                "رفع الملفات سيتم ربطه بجدول patient_files في خطوة لاحقة 🔧"
              );
            }
          }}
        >
          <Paperclip className="h-3 w-3 ms-1" />
          <span>رفع ملف (PDF / صورة)</span>
        </button>

        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={text}
            disabled={effectiveDisabled || sending}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              effectiveDisabled
                ? "سيتم تفعيل المحادثة بعد بدء الجلسة…"
                : "اكتب رسالتك هنا ثم اضغط Enter أو زر الإرسال…"
            }
            className="flex-1 rounded-2xl bg-slate-950/80 border border-slate-700 px-3 py-2 text-xs sm:text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={effectiveDisabled || sending || !text.trim()}
            className={classNames(
              "inline-flex items-center justify-center rounded-2xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold",
              effectiveDisabled || !text.trim()
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
            )}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
