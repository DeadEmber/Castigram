import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getSession } from "@/lib/auth";
import { aggregate } from "@/lib/feed";
import { BandoCard, type BandoCardData } from "@/components/BandoCard";
import type { Bando } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const pueblo = process.env.NEXT_PUBLIC_PUEBLO ?? "el pueblo";

export default async function HomePage() {
  const { supabase, user, profile } = await getSession();

  const { data: bandos } = await supabase
    .from("bandos")
    .select("*")
    .order("urgent", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const list = (bandos as Bando[]) ?? [];
  const agg = await aggregate(
    supabase,
    "bando_id",
    list.map((b) => b.id),
    user?.id ?? null
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-brand-600" />
        <h1 className="font-display text-2xl font-semibold text-brand-800">
          Bandos oficiales
        </h1>
      </div>
      <p className="-mt-2 text-sm text-stone-500">
        Avisos del ayuntamiento de {pueblo}. Sustituyen al bando municipal.
      </p>

      {profile?.role === "admin" && (
        <Link href="/admin" className="btn-primary w-full">
          + Publicar un bando
        </Link>
      )}

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {list.map((bando) => {
            const data: BandoCardData = {
              bando,
              authorName: "Ayuntamiento",
              likeCount: agg.likeCount.get(bando.id) ?? 0,
              likedByMe: agg.likedByMe.has(bando.id),
              commentCount: agg.commentCount.get(bando.id) ?? 0,
            };
            return (
              <BandoCard
                key={bando.id}
                data={data}
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

function EmptyState() {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <Megaphone className="h-10 w-10 text-brand-300" />
      <p className="font-medium text-stone-600">Todavía no hay bandos.</p>
      <p className="text-sm text-stone-400">
        Cuando el ayuntamiento publique un aviso, aparecerá aquí.
      </p>
    </div>
  );
}
