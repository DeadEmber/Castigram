"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Trash2 } from "lucide-react";
import { LikeButton } from "./LikeButton";
import { CommentsSection } from "./CommentsSection";
import { Avatar } from "./Avatar";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/supabase/types";

export type PostCardData = {
  post: Post;
  authorName: string;
  authorAvatar: string | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
};

export function PostCard({
  data,
  loggedIn,
  currentUserId,
  isAdmin,
}: {
  data: PostCardData;
  loggedIn: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const { post } = data;
  const [showComments, setShowComments] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const supabase = createClient();

  if (deleted) return null;

  const canDelete = isAdmin || post.author_id === currentUserId;

  async function onDelete() {
    if (!confirm("¿Borrar esta publicación?")) return;
    await supabase.from("posts").delete().eq("id", post.id);
    setDeleted(true);
  }

  return (
    <article className="card p-4">
      <div className="flex items-center gap-3">
        <Link href={`/vecino/${post.author_id}`}>
          <Avatar name={data.authorName} url={data.authorAvatar} size={40} />
        </Link>
        <div className="flex-1">
          <Link
            href={`/vecino/${post.author_id}`}
            className="text-sm font-semibold text-stone-800 hover:text-brand-700 hover:underline"
          >
            {data.authorName}
          </Link>
          <p className="text-xs text-stone-400">{timeAgo(post.created_at)}</p>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="text-stone-300 hover:text-red-600"
            aria-label="Borrar publicación"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-700">
        {post.body}
      </p>

      {post.image_url && (
        <Image
          src={post.image_url}
          alt=""
          width={800}
          height={600}
          className="mt-3 h-auto w-full rounded-xl object-cover"
        />
      )}

      <div className="mt-3 flex items-center gap-5 border-t border-brand-50 pt-3">
        <LikeButton
          target="post"
          targetId={post.id}
          initialCount={data.likeCount}
          initiallyLiked={data.likedByMe}
          loggedIn={loggedIn}
        />
        <button
          onClick={() => setShowComments((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-700"
        >
          <MessageCircle className="h-5 w-5" />
          {data.commentCount > 0 && <span>{data.commentCount}</span>}
        </button>
      </div>

      {showComments && (
        <CommentsSection
          target="post"
          targetId={post.id}
          loggedIn={loggedIn}
          currentUserId={currentUserId}
        />
      )}
    </article>
  );
}
