"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "./ImageUpload";
import { createClient } from "@/lib/supabase/client";

export function NewPostForm({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("posts").insert({
      author_id: userId,
      body: body.trim(),
      image_url: image,
    });
    if (error) {
      setError("No se pudo publicar. Inténtalo de nuevo.");
      setSaving(false);
      return;
    }
    router.push("/muro");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <textarea
        className="input min-h-28 resize-y"
        placeholder="¿Qué quieres compartir con el pueblo?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={3000}
      />
      <ImageUpload value={image} onChange={setImage} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving || !body.trim()} className="btn-primary w-full">
        {saving ? "Publicando…" : "Publicar en el muro"}
      </button>
    </form>
  );
}
