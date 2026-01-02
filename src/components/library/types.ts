export type LibraryCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  hero_image_path: string | null;
};

export type LibraryBook = {
  id: string;

  title: string;
  author_name: string | null;
  description: string | null;
  toc: string | null;

  category_id: string;

  cover_path: string;
  preview_file_path: string | null;
  full_file_path: string | null;

  preview_enabled: boolean;

  is_paid: boolean;
  price: number | null;
  currency: string | null;

  shelf: "scientific" | "prophetic" | "folk";

  status: "pending" | "approved" | "rejected";
  review_reason: string | null;

  submitted_by_user_id: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;

  created_at: string;
};

export type LibraryCounts = {
  view_preview_count: number;
  download_click_count: number;
  download_success_count: number;
};
