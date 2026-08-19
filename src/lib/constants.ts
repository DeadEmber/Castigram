import type { BandoCategory, ListingCategory } from "./supabase/types";

// Etiquetas y colores para cada categoría de bando.
export const BANDO_CATEGORIES: Record<
  BandoCategory,
  { label: string; className: string; emoji: string }
> = {
  general: { label: "General", className: "bg-stone-100 text-stone-700", emoji: "📣" },
  agua: { label: "Agua", className: "bg-sky-100 text-sky-700", emoji: "💧" },
  luz: { label: "Luz", className: "bg-amber-100 text-amber-700", emoji: "💡" },
  fiestas: { label: "Fiestas", className: "bg-fuchsia-100 text-fuchsia-700", emoji: "🎉" },
  pleno: { label: "Pleno", className: "bg-indigo-100 text-indigo-700", emoji: "🏛️" },
  obras: { label: "Obras", className: "bg-orange-100 text-orange-700", emoji: "🚧" },
  sanidad: { label: "Sanidad", className: "bg-emerald-100 text-emerald-700", emoji: "⚕️" },
  urgente: { label: "Urgente", className: "bg-red-100 text-red-700", emoji: "🚨" },
};

export const LISTING_CATEGORIES: Record<
  ListingCategory,
  { label: string; className: string; emoji: string }
> = {
  venta: { label: "Se vende", className: "bg-emerald-100 text-emerald-700", emoji: "🏷️" },
  compra: { label: "Se busca", className: "bg-sky-100 text-sky-700", emoji: "🔎" },
  servicio: { label: "Servicio", className: "bg-indigo-100 text-indigo-700", emoji: "🛠️" },
  alquiler: { label: "Alquiler", className: "bg-amber-100 text-amber-700", emoji: "🔑" },
  regalo: { label: "Se regala", className: "bg-fuchsia-100 text-fuchsia-700", emoji: "🎁" },
};
