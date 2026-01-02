// src/app/post/[id]/page.tsx
import PostDetailsClient from "@/components/posts/PostDetailsClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PostPage({ params }: PageProps) {
  const { id } = await params; // ✅ لازم await

  return <PostDetailsClient postId={id} />;
}
