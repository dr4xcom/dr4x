"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type AdType = "image" | "video" | "audio";

type AdConfig = {
  enabled: boolean;
  type: AdType;
  path: string | null; // مثال: "ads-videos/ad.mp4" أو "ads-images/ad.webp" أو "ads-audio/ad.mp3"
  duration: number;
};

export default function GlobalAd() {
  const [ad, setAd] = useState<AdConfig | null>(null);
  const [visible, setVisible] = useState(true);

  const timerRef = useRef<any>(null);

  function closeAd() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value, value_number")
        .in("key", [
          "global_ad_enabled",
          "global_ad_type",
          "global_ad_path",
          "global_ad_duration",
        ]);

      if (!data) return;

      const map = Object.fromEntries(
        data.map((r) => [r.key, r.value ?? r.value_number])
      );

      if (map.global_ad_enabled !== "true") return;

      const t = (map.global_ad_type as AdType) || "image";
      const p = (map.global_ad_path as string) || null;
      const d = Number(map.global_ad_duration ?? 30);

      const config: AdConfig = {
        enabled: true,
        type: t,
        path: p,
        duration: d,
      };

      setAd(config);
      setVisible(true);

      timerRef.current = setTimeout(() => {
        setVisible(false);
      }, d * 1000);
    })();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!ad || !visible || !ad.path) return null;

  // ✅ إصلاح الرابط: نستخرج bucket و objectPath من "ads-videos/ad.mp4"
  const [bucket, ...rest] = ad.path.split("/");
  const objectPath = rest.join("/");

  // لو أي خطأ في المسار
  if (!bucket || !objectPath) return null;

  const src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center"
      onClick={closeAd}
    >
      <div
        className="bg-white rounded-2xl p-3 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 300 }}
      >
        {ad.type === "image" && (
          <img
            src={src}
            alt="Ad"
            className="w-full rounded-xl cursor-pointer"
            style={{ maxHeight: 300, objectFit: "contain" }}
            onClick={closeAd}
          />
        )}

        {ad.type === "video" && (
          <video
            src={src}
            autoPlay
            muted
            playsInline
            controls
            className="w-full rounded-xl cursor-pointer"
            style={{ maxHeight: 300, objectFit: "contain" }}
            onClick={closeAd}
            onEnded={closeAd}
          />
        )}

        {ad.type === "audio" && (
          <audio
            src={src}
            autoPlay
            controls
            className="w-full"
            onEnded={closeAd}
            onPlay={() => {
              // اختياري: لو تبي يبدأ العد من أول تشغيل الصوت فقط، احذف هذا التعليق وعدل المنطق
            }}
          />
        )}
      </div>
    </div>
  );
}
