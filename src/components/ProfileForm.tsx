"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, ExternalLink } from "lucide-react";
import { Avatar } from "./Avatar";
import { ImageUpload } from "./ImageUpload";
import { RELATION_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

type Vecino = { id: string; full_name: string; nickname: string | null };

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(profile.full_name);
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url);

  // Vínculo familiar.
  const [relationType, setRelationType] = useState(profile.relation_type ?? "");
  // "registrado" = enlazar a un vecino de la app; "texto" = escribir el nombre.
  const [linkMode, setLinkMode] = useState<"registrado" | "texto">(
    profile.relation_name && !profile.relation_to ? "texto" : "registrado"
  );
  const [relationTo, setRelationTo] = useState(profile.relation_to ?? "");
  const [relationName, setRelationName] = useState(profile.relation_name ?? "");

  const [vecinos, setVecinos] = useState<Vecino[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Cargar la lista de vecinos para el desplegable del vínculo.
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, nickname")
      .neq("id", profile.id)
      .order("full_name")
      .then(({ data }) => setVecinos((data as Vecino[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    // Normalizar el vínculo según el modo elegido.
    const hasRelation = relationType.trim().length > 0;
    const rel = {
      relation_type: hasRelation ? relationType : null,
      relation_to:
        hasRelation && linkMode === "registrado" && relationTo ? relationTo : null,
      relation_name:
        hasRelation && linkMode === "texto" && relationName.trim()
          ? relationName.trim()
          : null,
    };

    await supabase
      .from("profiles")
      .update({
        full_name: name.trim() || "Vecino",
        nickname: nickname.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatar,
        ...rel,
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
            <p className="font-semibold text-stone-800">
              {name}
              {nickname && (
                <span className="ml-1 font-normal text-stone-400">
                  «{nickname}»
                </span>
              )}
            </p>
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
            <label className="label" htmlFor="nickname">Apodo (opcional)</label>
            <input
              id="nickname"
              className="input"
              placeholder="Ej. el de la era, la del estanco…"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* ------- Vínculo familiar ------- */}
          <div className="rounded-xl bg-brand-50 p-3">
            <label className="label">¿De quién eres? (opcional)</label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input w-auto flex-none"
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
              >
                <option value="">— sin vínculo —</option>
                {RELATION_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              {relationType && linkMode === "registrado" && (
                <select
                  className="input flex-1"
                  value={relationTo}
                  onChange={(e) => setRelationTo(e.target.value)}
                >
                  <option value="">— elige un vecino —</option>
                  {vecinos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name}
                      {v.nickname ? ` («${v.nickname}»)` : ""}
                    </option>
                  ))}
                </select>
              )}

              {relationType && linkMode === "texto" && (
                <input
                  className="input flex-1"
                  placeholder="Nombre de la persona"
                  value={relationName}
                  onChange={(e) => setRelationName(e.target.value)}
                  maxLength={80}
                />
              )}
            </div>

            {relationType && (
              <button
                type="button"
                onClick={() =>
                  setLinkMode((m) => (m === "registrado" ? "texto" : "registrado"))
                }
                className="mt-2 text-xs text-brand-700 underline"
              >
                {linkMode === "registrado"
                  ? "¿No está en la app? Escribir el nombre a mano"
                  : "Elegir un vecino registrado"}
              </button>
            )}
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

      <Link href={`/vecino/${profile.id}`} className="btn-outline w-full">
        <ExternalLink className="h-4 w-4" /> Ver mi perfil público
      </Link>

      <form action="/auth/signout" method="post">
        <button type="submit" className="btn-outline w-full">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </form>
    </div>
  );
}
