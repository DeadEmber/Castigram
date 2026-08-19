"use client";

import Link from "next/link";
import { LISTING_CATEGORIES } from "@/lib/constants";
import type { ListingCategory } from "@/lib/supabase/types";

// Filtro por categoría del mercadillo (usa la query string ?cat=).
export function MercadilloFilter({ active }: { active: ListingCategory | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/mercadillo"
        className={`chip ${active === null ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-700"}`}
      >
        Todo
      </Link>
      {(Object.keys(LISTING_CATEGORIES) as ListingCategory[]).map((c) => (
        <Link
          key={c}
          href={`/mercadillo?cat=${c}`}
          className={`chip ${active === c ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-700"}`}
        >
          {LISTING_CATEGORIES[c].emoji} {LISTING_CATEGORIES[c].label}
        </Link>
      ))}
    </div>
  );
}
