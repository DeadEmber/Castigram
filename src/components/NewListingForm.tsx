"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "./ImageUpload";
import { LISTING_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { ListingCategory } from "@/lib/supabase/types";

export function NewListingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ListingCategory>("venta");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPrice = category === "venta" || category === "alquiler";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    setError(null);

    let price_cents: number | null = null;
    if (showPrice && price.trim()) {
      const parsed = Math.round(parseFloat(price.replace(",", ".")) * 100);
      price_cents = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }

    const { error } = await supabase.from("listings").insert({
      author_id: userId,
      title: title.trim(),
      description: description.trim(),
      category,
      price_cents,
      image_url: image,
    });
    if (error) {
      setError("No se pudo publicar. Inténtalo de nuevo.");
      setSaving(false);
      return;
    }
    router.push("/mercadillo");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div>
        <label className="label">Tipo de anuncio</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LISTING_CATEGORIES) as ListingCategory[]).map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCategory(c)}
              className={`chip cursor-pointer ${
                category === c
                  ? "bg-brand-600 text-white"
                  : "bg-brand-100 text-brand-700"
              }`}
            >
              {LISTING_CATEGORIES[c].emoji} {LISTING_CATEGORIES[c].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="title">Título</label>
        <input
          id="title"
          className="input"
          placeholder="Ej. Bici de montaña"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
      </div>

      <div>
        <label className="label" htmlFor="desc">Descripción</label>
        <textarea
          id="desc"
          className="input min-h-24 resize-y"
          placeholder="Cuenta los detalles: estado, medidas, cómo contactar…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={3000}
        />
      </div>

      {showPrice && (
        <div>
          <label className="label" htmlFor="price">Precio (€) — opcional</label>
          <input
            id="price"
            className="input"
            inputMode="decimal"
            placeholder="Ej. 50"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      )}

      <ImageUpload value={image} onChange={setImage} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving || !title.trim() || !description.trim()}
        className="btn-primary w-full"
      >
        {saving ? "Publicando…" : "Publicar anuncio"}
      </button>
    </form>
  );
}
