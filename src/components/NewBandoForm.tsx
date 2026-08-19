"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { BANDO_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { BandoCategory } from "@/lib/supabase/types";

// Formulario para que el ayuntamiento publique un bando oficial.
export function NewBandoForm({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<BandoCategory>("general");
  const [urgent, setUrgent] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("bandos").insert({
      author_id: userId,
      title: title.trim(),
      body: body.trim(),
      category: urgent ? "urgente" : category,
      urgent,
      image_url: image,
    });
    if (error) {
      setError(
        "No se pudo publicar. ¿Seguro que tu cuenta es de administrador?"
      );
      setSaving(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4">
      <div>
        <label className="label" htmlFor="title">Título del bando</label>
        <input
          id="title"
          className="input"
          placeholder="Ej. Corte de agua el martes"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
      </div>

      <div>
        <label className="label" htmlFor="body">Contenido</label>
        <textarea
          id="body"
          className="input min-h-40 resize-y"
          placeholder="Redacta el aviso para los vecinos…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
        />
      </div>

      <div>
        <label className="label">Categoría</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BANDO_CATEGORIES) as BandoCategory[])
            .filter((c) => c !== "urgente")
            .map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`chip cursor-pointer ${
                  category === c && !urgent
                    ? "bg-brand-600 text-white"
                    : "bg-brand-100 text-brand-700"
                }`}
                disabled={urgent}
              >
                {BANDO_CATEGORIES[c].emoji} {BANDO_CATEGORIES[c].label}
              </button>
            ))}
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl bg-red-50 p-3">
        <input
          type="checkbox"
          checked={urgent}
          onChange={(e) => setUrgent(e.target.checked)}
          className="h-5 w-5 accent-red-600"
        />
        <span className="flex items-center gap-1.5 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Marcar como URGENTE (avisa a todos los vecinos)
        </span>
      </label>

      <ImageUpload value={image} onChange={setImage} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving || !title.trim() || !body.trim()}
        className="btn-primary w-full"
      >
        {saving ? "Publicando…" : "Publicar bando"}
      </button>
    </form>
  );
}
