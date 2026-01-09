import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
    unoptimized: true, // ✅ هذا أهم سطر: يمنع optimizer اللي يسبب 400
  },
};

export default nextConfig;
