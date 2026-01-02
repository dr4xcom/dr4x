import CategoryPageClient from "@/components/library/CategoryPageClient";

export default async function LibraryCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CategoryPageClient categoryId={id} />;
}
