import Link from "next/link";
import { ShoppingBag, Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { MercadilloFilter } from "@/components/MercadilloFilter";
import type { Listing, Profile, ListingCategory } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type ListingRow = Listing & {
  author: Pick<Profile, "full_name" | "avatar_url"> | null;
};

export default async function MercadilloPage({
  searchParams,
}: {
  searchParams: { cat?: string };
}) {
  const { supabase, user, profile } = await getSession();
  const cat = searchParams.cat as ListingCategory | undefined;

  let query = supabase
    .from("listings")
    .select("*, author:profiles(full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (cat) query = query.eq("category", cat);

  const { data } = await query;
  const list = (data as unknown as ListingRow[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShoppingBag className="h-6 w-6 text-brand-600" />
        <h1 className="font-display text-2xl font-semibold text-brand-800">
          Mercadillo
        </h1>
      </div>

      <Link href="/nuevo?tipo=anuncio" className="btn-primary w-full">
        <Plus className="h-4 w-4" /> Poner un anuncio
      </Link>

      <MercadilloFilter active={cat ?? null} />

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm text-stone-400">
          No hay anuncios en esta categoría.
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((listing) => {
            const cardData: ListingCardData = {
              listing,
              authorName: listing.author?.full_name ?? "Vecino",
              authorAvatar: listing.author?.avatar_url ?? null,
            };
            return (
              <ListingCard
                key={listing.id}
                data={cardData}
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
