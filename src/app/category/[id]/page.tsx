import CategoryPageClient from "@/components/library/CategoryPageClient";

export default function LibraryCategoryPage({ params }: { params: { id: string } }) {
  return <CategoryPageClient categoryId={params.id} />;
}
