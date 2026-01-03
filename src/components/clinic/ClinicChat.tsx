// src/components/clinic/ClinicChat.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Msg = {
  id: string;
  ts: number;
  from: string;
  role: string;
  text: string;
};

export default function ClinicChat({
  consultationId,
  me,
  role,
  disabled,
}: {
  consultationId: string;
  me: string;
  role: string;
  disabled?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const channelName = useMemo(
    () => `clinic:${consultationId}`,
    [consultationId]
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ✅ قناة واحدة فقط للاشتراك + الإرسال
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // إذا Disabled لا نشترك أصلاً
    if (disabled) return;

    const ch = supabase.channel(channelName);
    channelRef.current = ch;

    ch.on("broadcast", { event: "chat" }, (payload) => {
      const m = payload.payload as Msg;
      setMessages((prev) => [...prev, m].slice(-200));
    });

    ch.subscribe();

    return () => {
      try {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      } finally {
        channelRef.current = null;
      }
    };
  }, [channelName, disabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (disabled) return;

    const t = text.trim();
    if (!t) return;
    setErr(null);

    const msg: Msg = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ts: Date.now(),
      from: me,
      role,
      text: t,
    };

    const ch = channelRef.current;
    if (!ch) {
      setErr("القناة غير جاهزة. حاول مرة أخرى.");
      return;
    }

    // ✅ تعديل هنا فقط: نتعامل مع نتيجة send كـ any عشان TypeScript
    const res = (await ch.send({
      type: "broadcast",
      event: "chat",
      payload: msg,
    } as any)) as any;

    const error = (res as any)?.error;

    if (error) {
      setErr(error.message ?? String(error));
      return;
    }

    // optimistic
    setMessages((prev) => [...prev, msg].slice(-200));
    setText("");
  }

  if (disabled) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="font-bold">الشات المباشر</div>
        <div className="text-sm text-slate-300 mt-1">
          الشات متوقف من الإدارة.
        </div>
        <div className="text-xs text-slate-500 mt-2">
          يمكن تفعيله من: /admin/settings
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="font-bold mb-2">الشات المباشر</div>

      <div className="h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-950/30 p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-400">ابدأ المحادثة…</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="text-xs text-slate-500">[{m.role}]</span>{" "}
              <span className="text-slate-200">{m.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {err ? <div className="mt-2 text-sm text-red-200">{err}</div> : null}

      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رسالة…"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          onClick={send}
          className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm font-extrabold text-slate-200 hover:bg-slate-900"
        >
          إرسال
        </button>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        * الشات “Live” (Realtime) بدون تخزين دائم. سنضيف التخزين لاحقًا بجداول
        جديدة Add-only.
      </div>
    </div>
  );
}
