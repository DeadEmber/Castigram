import { createClient } from "./supabase/server";
import type { Profile } from "./supabase/types";

// Devuelve el usuario y su perfil (o nulos si no ha iniciado sesión).
export async function getSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null as Profile | null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile: profile as Profile | null };
}
