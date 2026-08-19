"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar } from "./Avatar";
import { ImageUpload } from "./ImageUpload";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(profile.full_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await supabase
      .from("profiles")
      .update({
        full_name: name.trim() || "Vecino",
        bio: bio.trim() || null,
        avatar_url: avatar,
      })
      .eq("id", profile.id);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={name} url={avatar} size={56} />
          <div>
            <p className="font-semibold text-stone-800">{name}</p>
            {profile.role === "admin" && (
              <span className="chip bg-brand-600 text-white">Ayuntamiento</span>
            )}
          </div>
        </div>

        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label" htmlFor="name">Nombre</label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="bio">Sobre mí</label>
            <textarea
              id="bio"
              className="input min-h-20 resize-y"
              placeholder="Ej. Vivo en la plaza, me gusta la huerta…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
            />
          </div>
          <div>
            <label className="label">Foto de perfil</label>
            <ImageUpload value={avatar} onChange={setAvatar} />
          </div>
          {saved && <p className="text-sm text-emerald-600">Perfil guardado.</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </div>

      <form action="/auth/signout" method="post">
        <button type="submit" className="btn-outline w-full">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </form>
    </div>
  );
}
