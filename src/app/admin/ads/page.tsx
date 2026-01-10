"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type AdType = "image" | "video" | "audio";

export default function AdminAdsPage() {
  const [enabled, setEnabled] = useState(true);
  const [type, setType] = useState<AdType>("image");
  const [path, setPath] = useState("");
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value, value_number")
        .in("key", [
          "global_ad_enabled",
          "global_ad_type",
          "global_ad_path",
          "global_ad_duration",
        ]);

      if (error) {
        setMsg(`✖ LOAD SETTINGS ERROR: ${error.message}`);
        return;
      }
      if (!data) return;

      const map = Object.fromEntries(
        data.map((r) => [r.key, r.value ?? r.value_number])
      );

      setEnabled(map.global_ad_enabled === "true");
      setType((map.global_ad_type as AdType) || "image");
      setPath((map.global_ad_path as string) || "");
      setDuration(Number(map.global_ad_duration || 30));
    })();
  }, []);

  async function resizeImageToWebp(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        try {
          // ✅ المطلوب: لا تتجاوز 300px
          const maxW = 300;
          const maxH = 300;

          let w = img.width;
          let h = img.height;

          // حافظ على التناسب
          const ratio = Math.min(maxW / w, maxH / h, 1);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context error");

          ctx.drawImage(img, 0, 0, w, h);

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url);
              if (!blob) return reject(new Error("Image convert failed"));
              resolve(blob);
            },
            "image/webp",
            0.82
          );
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed"));
      };

      img.src = url;
    });
  }

  // ✅ رفع الملف حسب النوع
  async function uploadFromDevice(file: File) {
    try {
      setUploading(true);
      setMsg(null);

      const MAX_IMAGE_MB = 2;
      const MAX_VIDEO_MB = 10;
      const MAX_AUDIO_MB = 5;

      if (type === "image") {
        const webp = await resizeImageToWebp(file);
        const sizeMb = webp.size / (1024 * 1024);

        if (sizeMb > MAX_IMAGE_MB) {
          setMsg(
            `✖ IMAGE TOO LARGE AFTER RESIZE: ${sizeMb.toFixed(
              2
            )}MB > ${MAX_IMAGE_MB}MB`
          );
          return;
        }

        const bucket = "ads-images";
        const uploadPath = "ad.webp";

        const { error } = await supabase.storage
          .from(bucket)
          .upload(uploadPath, webp, {
            upsert: true,
            contentType: "image/webp",
            cacheControl: "3600",
          });

        if (error) throw error;

        setPath(`${bucket}/${uploadPath}`);
        setMsg("✔ IMAGE UPLOADED + PATH SET");
        return;
      }

      if (type === "video") {
        const sizeMb = file.size / (1024 * 1024);
        if (sizeMb > MAX_VIDEO_MB) {
          setMsg(
            `✖ VIDEO TOO LARGE: ${sizeMb.toFixed(2)}MB > ${MAX_VIDEO_MB}MB`
          );
          return;
        }

        const bucket = "ads-videos";
        const uploadPath = "ad.mp4";

        const { error } = await supabase.storage
          .from(bucket)
          .upload(uploadPath, file, {
            upsert: true,
            contentType: "video/mp4",
            cacheControl: "3600",
          });

        if (error) throw error;

        setPath(`${bucket}/${uploadPath}`);
        setMsg("✔ VIDEO UPLOADED + PATH SET");
        return;
      }

      // audio
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > MAX_AUDIO_MB) {
        setMsg(`✖ AUDIO TOO LARGE: ${sizeMb.toFixed(2)}MB > ${MAX_AUDIO_MB}MB`);
        return;
      }

      const bucket = "ads-audio";
      const uploadPath = "ad.mp3";

      const { error } = await supabase.storage
        .from(bucket)
        .upload(uploadPath, file, {
          upsert: true,
          contentType: "audio/mpeg",
          cacheControl: "3600",
        });

      if (error) throw error;

      setPath(`${bucket}/${uploadPath}`);
      setMsg("✔ AUDIO UPLOADED + PATH SET");
    } catch (e: any) {
      const m =
        typeof e?.message === "string"
          ? e.message
          : typeof e?.error === "string"
          ? e.error
          : JSON.stringify(e);
      setMsg(`✖ ERROR UPLOADING FILE: ${m}`);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setMsg(null);

      const results = await Promise.all([
        supabase.from("system_settings").upsert(
          {
            key: "global_ad_enabled",
            value: enabled ? "true" : "false",
          },
          { onConflict: "key" }
        ),
        supabase.from("system_settings").upsert(
          {
            key: "global_ad_type",
            value: type,
          },
          { onConflict: "key" }
        ),
        supabase.from("system_settings").upsert(
          {
            key: "global_ad_path",
            value: path,
          },
          { onConflict: "key" }
        ),
        supabase.from("system_settings").upsert(
          {
            key: "global_ad_duration",
            value_number: duration,
          },
          { onConflict: "key" }
        ),
      ]);

      const firstErr = results.find((r) => (r as any)?.error)?.error;
      if (firstErr) {
        setMsg(`✖ ERROR SAVING SETTINGS: ${firstErr.message ?? "Unknown"}`);
        return;
      }

      setMsg("✔ SETTINGS SAVED SUCCESSFULLY");
    } catch (e: any) {
      setMsg(`✖ ERROR SAVING SETTINGS: ${e?.message ?? "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-emerald-400 p-6 font-mono">
      <div className="max-w-3xl mx-auto border border-emerald-500 rounded-xl p-6 space-y-6">
        <div className="text-lg font-bold tracking-widest">
          SYSTEM CONSOLE :: GLOBAL ADS
        </div>

        <div className="text-xs text-emerald-300">
          Control global temporary media display (image / video / audio)
        </div>

        <div className="flex items-center justify-between border border-emerald-800 rounded-lg p-3 bg-black/60">
          <span>AD STATUS</span>
          <button
            onClick={() => setEnabled((v) => !v)}
            className={[
              "px-4 py-1 rounded",
              enabled ? "bg-emerald-500 text-black" : "bg-red-600 text-white",
            ].join(" ")}
          >
            {enabled ? "ENABLED" : "DISABLED"}
          </button>
        </div>

        <div className="border border-emerald-800 rounded-lg p-3 bg-black/60">
          <div className="mb-2">MEDIA TYPE</div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AdType)}
            className="w-full bg-black border border-emerald-500 text-emerald-300 px-3 py-2 rounded"
          >
            <option value="image">IMAGE</option>
            <option value="video">VIDEO</option>
            <option value="audio">AUDIO</option>
          </select>
        </div>

        <div className="border border-emerald-800 rounded-lg p-3 bg-black/60">
          <div className="mb-2">UPLOAD FROM DEVICE</div>

          <input
            type="file"
            accept={
              type === "image"
                ? "image/*"
                : type === "video"
                ? "video/*"
                : "audio/*"
            }
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFromDevice(f);
              e.currentTarget.value = "";
            }}
            className="w-full bg-black border border-emerald-500 text-emerald-300 px-3 py-2 rounded"
          />

          <div className="mt-2 text-[11px] text-emerald-300/80">
            {type === "image"
              ? "Auto-resize: max 300x300, output WebP, must be ≤ 2MB"
              : type === "video"
              ? "Video must be ≤ 10MB (saved as ad.mp4)"
              : "Audio must be ≤ 5MB (saved as ad.mp3)"}
          </div>

          {uploading ? <div className="mt-2 text-xs">UPLOADING...</div> : null}
        </div>

        <div className="border border-emerald-800 rounded-lg p-3 bg-black/60">
          <div className="mb-2">MEDIA PATH (storage)</div>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="ads-images/ad.webp | ads-videos/ad.mp4 | ads-audio/ad.mp3"
            className="w-full bg-black border border-emerald-500 text-emerald-300 px-3 py-2 rounded"
          />
        </div>

        <div className="border border-emerald-800 rounded-lg p-3 bg-black/60">
          <div className="mb-2">DISPLAY DURATION (SECONDS)</div>
          <input
            type="number"
            min={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full bg-black border border-emerald-500 text-emerald-300 px-3 py-2 rounded"
          />
        </div>

        <button
          onClick={save}
          disabled={saving || uploading}
          className="w-full bg-emerald-500 text-black py-3 rounded-lg font-bold tracking-widest hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? "SAVING..." : uploading ? "UPLOADING..." : "EXECUTE SAVE"}
        </button>

        {msg && (
          <div className="text-center text-sm tracking-widest">{msg}</div>
        )}
      </div>
    </div>
  );
}
