// src/app/api/ai/realtime-token/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET() {
  try {
    const apiKey = env("OPENAI_API_KEY");

    // ✅ مرر إعدادات session داخل body
    // (حسب دليل Realtime WebRTC: POST /v1/realtime/client_secrets)
    const sessionConfig = {
      session: {
        type: "realtime",
        // غيّرها إذا تبغى موديل ثاني
        // ملاحظة: لازم يكون موديل تدعمه Realtime في حسابك
        model: "gpt-realtime",
        audio: {
          output: {
            voice: "marin",
          },
        },
      },
    };

    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    const text = await r.text();

    if (!r.ok) {
      // ✅ رجّع تفاصيل الخطأ (مهم للتشخيص)
      return NextResponse.json(
        { error: "Failed to mint realtime token", details: text },
        { status: r.status }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
