"use client";

import { useState } from "react";
import Image from "next/image";
import { MessageCircle, Trash2, AlertTriangle } from "lucide-react";
import { LikeButton } from "./LikeButton";
import { CommentsSection } from "./CommentsSection";
import { BANDO_CATEGORIES } from "@/lib/constants";
import { fullDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Bando } from "@/lib/supabase/types";

export type BandoCardData = {
  bando: Bando;
  authorName: string;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
};

export function BandoCard({
  data,
  loggedIn,
  currentUserId,
  isAdmin,
}: {
  data: BandoCardData;
  loggedIn: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const { bando } = data;
  const cat = BANDO_CATEGORIES[bando.category];
  const [showComments, setShowComments] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const supabase = createClient();

  if (deleted) return null;

  async function onDelete() {
    if (!confirm("¿Borrar este bando?")) return;
    await supabase.from("bandos").delete().eq("id", bando.id);
    setDeleted(true);
  }

  return (
    <article
      className={`card overflow-hidden ${
        bando.urgent ? "ring-2 ring-red-400" : ""
      }`}
    >
      {bando.urgent && (
        <div className="flex items-center gap-2 bg-red-600 px-4 py-1.5 text-sm font-semibold text-white">
          <AlertTriangle className="h-4 w-4" /> Aviso urgente
        </div>
      )}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={`chip ${cat.className}`}>
            {cat.emoji} {cat.label}
          </span>
          <span className="text-xs text-stone-400">{fullDate(bando.created_at)}</span>
        </div>

        <h2 className="font-display text-lg font-semibold text-stone-900">
          {bando.title}
        </h2>
        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-700">
          {bando.body}
        </p>

        {bando.image_url && (
          <Image
            src={bando.image_url}
            alt=""
            width={800}
            height={600}
            className="mt-3 h-auto w-full rounded-xl object-cover"
          />
        )}

        <div className="mt-2 text-xs text-stone-400">
          Publicado por el {data.authorName}
        </div>

        <div className="mt-3 flex items-center gap-5 border-t border-brand-50 pt-3">
          <LikeButton
            target="bando"
            targetId={bando.id}
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
            <span className="sr-only">Comentarios</span>
          </button>
          {isAdmin && (
            <button
              onClick={onDelete}
              className="ml-auto text-stone-400 hover:text-red-600"
              aria-label="Borrar bando"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>

        {showComments && (
          <CommentsSection
            target="bando"
            targetId={bando.id}
            loggedIn={loggedIn}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </article>
  );
}
