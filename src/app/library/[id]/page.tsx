import BookDetailsClient from "@/components/library/BookDetailsClient";

export default async function LibraryBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookDetailsClient id={id} />;
}
