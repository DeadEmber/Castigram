"use client";

import { useState } from "react";
import Image from "next/image";
import { Trash2, CheckCircle2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { LISTING_CATEGORIES } from "@/lib/constants";
import { timeAgo, formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/lib/supabase/types";

export type ListingCardData = {
  listing: Listing;
  authorName: string;
  authorAvatar: string | null;
};

export function ListingCard({
  data,
  currentUserId,
  isAdmin,
}: {
  data: ListingCardData;
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const { listing } = data;
  const cat = LISTING_CATEGORIES[listing.category];
  const [deleted, setDeleted] = useState(false);
  const [status, setStatus] = useState(listing.status);
  const supabase = createClient();

  if (deleted) return null;

  const isOwner = listing.author_id === currentUserId;
  const canManage = isOwner || isAdmin;

  async function onDelete() {
    if (!confirm("¿Borrar este anuncio?")) return;
    await supabase.from("listings").delete().eq("id", listing.id);
    setDeleted(true);
  }

  async function toggleStatus() {
    const next = status === "activo" ? "cerrado" : "activo";
    await supabase.from("listings").update({ status: next }).eq("id", listing.id);
    setStatus(next);
  }

  return (
    <article className={`card p-4 ${status === "cerrado" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`chip ${cat.className}`}>
          {cat.emoji} {cat.label}
        </span>
        {listing.price_cents !== null && (
          <span className="font-display text-lg font-semibold text-brand-700">
            {formatPrice(listing.price_cents)}
          </span>
        )}
      </div>

      <h3 className="mt-2 text-base font-semibold text-stone-900">
        {listing.title}
        {status === "cerrado" && (
          <span className="ml-2 text-xs font-normal text-stone-400">(cerrado)</span>
        )}
      </h3>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
        {listing.description}
      </p>

      {listing.image_url && (
        <Image
          src={listing.image_url}
          alt=""
          width={800}
          height={600}
          className="mt-3 h-auto w-full rounded-xl object-cover"
        />
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-brand-50 pt-3">
        <Avatar name={data.authorName} url={data.authorAvatar} size={28} />
        <span className="text-xs text-stone-500">
          {data.authorName} · {timeAgo(listing.created_at)}
        </span>

        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            {isOwner && (
              <button
                onClick={toggleStatus}
                className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-emerald-600"
              >
                <CheckCircle2 className="h-4 w-4" />
                {status === "activo" ? "Marcar cerrado" : "Reabrir"}
              </button>
            )}
            <button
              onClick={onDelete}
              className="text-stone-300 hover:text-red-600"
              aria-label="Borrar anuncio"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
