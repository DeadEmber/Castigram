import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Users, ShoppingBag, Link2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { aggregate } from "@/lib/feed";
import { Avatar } from "@/components/Avatar";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import type { Profile, Post, Listing } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function VecinoPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, user, profile: me } = await getSession();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!profile) notFound();
  const p = profile as Profile;

  // Vecino con quien tiene el vínculo (si es un usuario registrado).
  let relatedName: string | null = null;
  let relatedId: string | null = null;
  if (p.relation_to) {
    const { data: rel } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", p.relation_to)
      .single();
    if (rel) {
      relatedName = (rel as Profile).full_name;
      relatedId = (rel as Profile).id;
    }
  } else if (p.relation_name) {
    relatedName = p.relation_name;
  }

  // Publicaciones y anuncios de este vecino.
  const [{ data: postsData }, { data: listingsData }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, author:profiles(full_name, avatar_url)")
      .eq("author_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("listings")
      .select("*, author:profiles(full_name, avatar_url)")
      .eq("author_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const posts = (postsData as unknown as (Post & {
    author: { full_name: string; avatar_url: string | null } | null;
  })[]) ?? [];
  const listings = (listingsData as unknown as (Listing & {
    author: { full_name: string; avatar_url: string | null } | null;
  })[]) ?? [];

  const agg = await aggregate(
    supabase,
    "post_id",
    posts.map((x) => x.id),
    user?.id ?? null
  );

  const isMe = user?.id === p.id;

  return (
    <div className="space-y-4">
      <Link
        href="/muro"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      {/* Ficha del vecino */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <Avatar name={p.full_name} url={p.avatar_url} size={72} />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-stone-900">
              {p.full_name}
            </h1>
            {p.nickname && (
              <p className="text-sm text-brand-700">«{p.nickname}»</p>
            )}
            {p.role === "admin" && (
              <span className="chip mt-1 bg-brand-600 text-white">Ayuntamiento</span>
            )}
          </div>
        </div>

        {p.relation_type && relatedName && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm text-stone-600">
            <Link2 className="h-4 w-4 text-brand-500" />
            {p.relation_type}{" "}
            {relatedId ? (
              <Link
                href={`/vecino/${relatedId}`}
                className="font-semibold text-brand-700 hover:underline"
              >
                {relatedName}
              </Link>
            ) : (
              <span className="font-semibold text-stone-700">{relatedName}</span>
            )}
          </p>
        )}

        {p.bio && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
            {p.bio}
          </p>
        )}

        {isMe && (
          <Link href="/perfil" className="btn-outline mt-4 w-full">
            <Pencil className="h-4 w-4" /> Editar mi perfil
          </Link>
        )}
      </div>

      {/* Publicaciones del muro */}
      <div className="flex items-center gap-2 pt-1">
        <Users className="h-5 w-5 text-brand-600" />
        <h2 className="font-display text-lg font-semibold text-brand-800">
          En el muro
        </h2>
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-stone-400">Todavía no ha publicado nada.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const data: PostCardData = {
              post,
              authorName: post.author?.full_name ?? p.full_name,
              authorAvatar: post.author?.avatar_url ?? p.avatar_url,
              likeCount: agg.likeCount.get(post.id) ?? 0,
              likedByMe: agg.likedByMe.has(post.id),
              commentCount: agg.commentCount.get(post.id) ?? 0,
            };
            return (
              <PostCard
                key={post.id}
                data={data}
                loggedIn={!!user}
                currentUserId={user?.id ?? null}
                isAdmin={me?.role === "admin"}
              />
            );
          })}
        </div>
      )}

      {/* Anuncios del mercadillo */}
      {listings.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <ShoppingBag className="h-5 w-5 text-brand-600" />
            <h2 className="font-display text-lg font-semibold text-brand-800">
              En el mercadillo
            </h2>
          </div>
          <div className="space-y-4">
            {listings.map((listing) => {
              const data: ListingCardData = {
                listing,
                authorName: listing.author?.full_name ?? p.full_name,
                authorAvatar: listing.author?.avatar_url ?? p.avatar_url,
              };
              return (
                <ListingCard
                  key={listing.id}
                  data={data}
                  currentUserId={user?.id ?? null}
                  isAdmin={me?.role === "admin"}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
