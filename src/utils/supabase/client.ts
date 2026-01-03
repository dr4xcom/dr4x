import { createClient } from "@supabase/supabase-js";

// 🔹 رابط مشروعك (ثابت)
const SUPABASE_URL = "https://wqmhwzpqaiesmpxrlyhf.supabase.co";

// 🔹 المفتاح العام (anon) — تم إدخاله
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxbWh3enBxYWllc21weHJseWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNDU3NzEsImV4cCI6MjA3OTYyMTc3MX0.K5xbGl34_Qq_jEJ-2OwUCdBUWYd6VNXqb9YBcdRDAIY";

if (!SUPABASE_URL) {
  throw new Error("Missing Supabase URL");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase anon key");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
