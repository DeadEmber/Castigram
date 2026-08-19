import Link from "next/link";
import { Users, PenLine } from "lucide-react";
import { getSession } from "@/lib/auth";
import { aggregate } from "@/lib/feed";
import { PostCard, type PostCardData } from "@/components/PostCard";
import type { Post, Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type PostRow = Post & {
  author: Pick<Profile, "full_name" | "avatar_url"> | null;
};

export default async function MuroPage() {
  const { supabase, user, profile } = await getSession();

  const { data } = await supabase
    .from("posts")
    .select("*, author:profiles(full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = (data as unknown as PostRow[]) ?? [];
  const agg = await aggregate(
    supabase,
    "post_id",
    list.map((p) => p.id),
    user?.id ?? null
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-brand-600" />
        <h1 className="font-display text-2xl font-semibold text-brand-800">
          Muro vecinal
        </h1>
      </div>

      <Link href="/nuevo" className="btn-primary w-full">
        <PenLine className="h-4 w-4" /> Escribir en el muro
      </Link>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm text-stone-400">
          Aún no hay publicaciones. ¡Anímate a ser el primero!
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((post) => {
            const cardData: PostCardData = {
              post,
              authorName: post.author?.full_name ?? "Vecino",
              authorAvatar: post.author?.avatar_url ?? null,
              likeCount: agg.likeCount.get(post.id) ?? 0,
              likedByMe: agg.likedByMe.has(post.id),
              commentCount: agg.commentCount.get(post.id) ?? 0,
            };
            return (
              <PostCard
                key={post.id}
                data={cardData}
                loggedIn={!!user}
                currentUserId={user?.id ?? null}
                isAdmin={profile?.role === "admin"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
