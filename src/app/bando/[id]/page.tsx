import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { aggregate } from "@/lib/feed";
import { BandoCard, type BandoCardData } from "@/components/BandoCard";
import type { Bando } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function BandoPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, user, profile } = await getSession();

  const { data: bando } = await supabase
    .from("bandos")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!bando) notFound();

  const agg = await aggregate(supabase, "bando_id", [params.id], user?.id ?? null);

  const data: BandoCardData = {
    bando: bando as Bando,
    authorName: "Ayuntamiento",
    likeCount: agg.likeCount.get(params.id) ?? 0,
    likedByMe: agg.likedByMe.has(params.id),
    commentCount: agg.commentCount.get(params.id) ?? 0,
  };

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a los bandos
      </Link>
      <BandoCard
        data={data}
        loggedIn={!!user}
        currentUserId={user?.id ?? null}
        isAdmin={profile?.role === "admin"}
      />
    </div>
  );
}
