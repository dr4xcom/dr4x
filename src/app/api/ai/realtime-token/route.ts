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

    // Realtime: mint ephemeral key (client secret)
    // Docs: /v1/realtime/client_secrets
    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // ممكن تضيف إعدادات جلسة هنا لو تحتاج لاحقًا
        // مثلاً: expires_in, etc (حسب الوثائق)
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      return NextResponse.json(
        { error: "Failed to mint realtime token", details: text },
        { status: 500 }
      );
    }

    // يرجع JSON فيه value أو client_secret حسب صيغة OpenAI الحالية
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
