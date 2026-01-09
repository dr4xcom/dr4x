// src/components/ai/VoiceAssistant.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stethoscope, Square, Volume2, Mic } from "lucide-react";

type Props = {
  /** وضع مدمج داخل سطر الأيقونات (بدون كروت كبيرة) */
  variant?: "inline" | "card";
  /** نص الترحيب (لهجة لبنانية) */
  greetText?: string;
  /** هل يرسل الترحيب فور بدء الجلسة */
  greetOnStart?: boolean;
  /** موديل الريلتايم */
  model?: string;
  /** اسم الصوت (حسب المتاح في Realtime). لو ما تعرف، خلّها marin */
  voice?: string;
};

type TokenResponse = {
  value?: string;
  client_secret?: string;
  expires_at?: number;
  session?: any;

  // ✅ للرسائل القادمة من API عند الفشل
  error?: string;
  details?: any;
};

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default function VoiceAssistant({
  variant = "inline",
  greetText,
  greetOnStart = true,
  model = "gpt-realtime-mini",
  voice = "marin",
}: Props) {
  const [status, setStatus] = useState<
    "idle" | "starting" | "listening" | "stopped" | "error"
  >("idle");
  const [err, setErr] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const startedOnceRef = useRef(false);

  const greet = useMemo(() => {
    return (
      greetText ||
      "أهلين وسهلين… شو فيك؟ ما تشوف شر. خبريني شو شكواك باختصار، وبعدها بقلك شو تعمل خطوة بخطوة."
    );
  }, [greetText]);

  async function fetchEphemeralToken() {
    const r = await fetch("/api/ai/realtime-token", { method: "GET" });
    const txt = await r.text();
    const js = safeJsonParse(txt) as TokenResponse | null;

    if (!r.ok) {
      // ✅ اعرض تفاصيل مفيدة بدل "400 ()"
      const msg =
        js?.error ||
        (typeof js?.details === "string" ? js.details : "") ||
        txt ||
        "Failed to get token";
      throw new Error(msg);
    }

    const key = js?.value || js?.client_secret;
    if (!key) throw new Error("Token response missing value/client_secret");

    return { key, raw: js };
  }

  function sendEvent(payload: any) {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;
    dc.send(JSON.stringify(payload));
  }

  async function start() {
    if (status === "starting" || status === "listening") return;

    setErr(null);
    setStatus("starting");

    try {
      // 1) Token
      const { key } = await fetchEphemeralToken();

      // 2) WebRTC
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // remote audio
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElRef.current = audioEl;

      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // local mic
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = ms;
      const track = ms.getTracks()[0];
      pc.addTrack(track, ms);

      // data channel
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("listening");

        // (اختياري) نرسل إعدادات + ترحيب بعد فتح القناة
        sendEvent({
          type: "session.update",
          session: {
            model,
            audio: { output: { voice } },
            instructions:
              "أنتِ مساعدة طبية صوتية ضمن موقع DR4X. تكلمي باللهجة اللبنانية بشكل لطيف وواقعي. اسألي عن الشكوى باختصار ثم وجّهي المستخدم لخطوات داخل الموقع: يفتح ملفه الصحي ويعبّي النموذج وينتظر دوره، وبعدها يدخل على التخصص المناسب (نفسية/باطنية/تجميل… إلخ). لا تعطي تشخيص نهائي، وقدّمي نصائح عامة فقط.",
          },
        });

        if (greetOnStart) {
          sendEvent({
            type: "response.create",
            response: {
              modalities: ["audio"],
              instructions: greet,
            },
          });
        }

        startedOnceRef.current = true;
      };

      dc.onmessage = (evt) => {
        // console.log("realtime event:", evt.data);
      };

      dc.onerror = () => {
        setErr("حصل خطأ في قناة البيانات.");
        setStatus("error");
      };

      // 3) Offer/Answer SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // ✅ جرب المسار الأحدث أولاً
      let answerSdp = "";
      let ok = false;

      // A) New endpoint
      try {
        const sdpResp = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp || "",
        });

        answerSdp = await sdpResp.text();
        ok = sdpResp.ok;

        // إذا رجع HTML أو نص فاضي، اعتبره فشل
        if (!ok) {
          // continue to fallback
        }
      } catch {
        ok = false;
      }

      // B) Fallback endpoint (القديم)
      if (!ok) {
        const sdpResp2 = await fetch(
          `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/sdp",
            },
            body: offer.sdp || "",
          }
        );

        answerSdp = await sdpResp2.text();
        if (!sdpResp2.ok) {
          throw new Error(answerSdp || "Failed to start realtime session");
        }
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (e: any) {
      setErr(e?.message || "فشل تشغيل المساعد الصوتي");
      setStatus("error");
      stop();
    }
  }

  function stop() {
    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;

    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    localStreamRef.current = null;

    try {
      if (audioElRef.current) {
        audioElRef.current.pause();
        // @ts-ignore
        audioElRef.current.srcObject = null;
      }
    } catch {}
    audioElRef.current = null;

    setStatus("stopped");
  }

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOn = status === "listening" || status === "starting";

  if (variant === "inline") {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={isOn ? stop : start}
          className={[
            "inline-flex items-center gap-2 select-none",
            "text-slate-700 hover:text-slate-900 transition",
          ].join(" ")}
          title={isOn ? "إيقاف المساعد" : "ابدأ المساعد الصوتي"}
        >
          {isOn ? <Square className="h-5 w-5" /> : <Stethoscope className="h-5 w-5" />}
          <span className="text-sm font-semibold">{isOn ? "إيقاف" : "ابدأ"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!isOn) return;
            sendEvent({
              type: "response.create",
              response: {
                modalities: ["audio"],
                instructions:
                  "خَلّصنا؟ طمني عليك. هل بدّك أوجهك للتخصص المناسب ولا تروح تعبي ملفك الصحي هلّق؟",
              },
            });
          }}
          className={[
            "inline-flex items-center gap-1 select-none",
            "text-slate-500 hover:text-slate-900 transition",
            "disabled:opacity-50",
          ].join(" ")}
          disabled={!isOn}
          title="تكلم"
        >
          <Mic className="h-4 w-4" />
        </button>

        {err ? <span className="text-xs text-red-600">{err}</span> : null}
      </div>
    );
  }

  return (
    <div className="dr4x-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">
          مساعد DR4X الصوتي{" "}
          <span className="text-xs text-slate-500 ms-2">{status}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isOn ? stop : start}
            className="rounded-full px-4 py-2 text-sm font-semibold bg-slate-900 text-white"
          >
            {isOn ? "إيقاف" : "ابدأ"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isOn) return;
              sendEvent({
                type: "response.create",
                response: {
                  modalities: ["audio"],
                  instructions: greet,
                },
              });
            }}
            className="rounded-full px-3 py-2 text-sm font-semibold bg-slate-100 text-slate-900 disabled:opacity-50"
            disabled={!isOn}
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {err ? <div className="mt-2 text-sm text-red-600">{err}</div> : null}

      <div className="mt-3 text-sm text-slate-600">
        ملاحظة: على الجوال لازم المستخدم يضغط “ابدأ” عشان يسمح للمايك والصوت.
      </div>
    </div>
  );
}
