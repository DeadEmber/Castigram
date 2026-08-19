import type { SupabaseClient } from "@supabase/supabase-js";

// Cuenta likes y comentarios por elemento, y marca cuáles ha likeado el usuario.
// Pensado para la escala de un pueblo (pocos cientos de elementos por página).
export async function aggregate(
  supabase: SupabaseClient,
  column: "bando_id" | "post_id",
  ids: string[],
  userId: string | null
) {
  const empty = {
    likeCount: new Map<string, number>(),
    commentCount: new Map<string, number>(),
    likedByMe: new Set<string>(),
  };
  if (ids.length === 0) return empty;

  const [likesRes, commentsRes] = await Promise.all([
    supabase.from("likes").select("user_id," + column).in(column, ids),
    supabase.from("comments").select(column).in(column, ids),
  ]);

  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const row of (likesRes.data ?? []) as unknown as Record<string, string>[]) {
    const id = row[column];
    likeCount.set(id, (likeCount.get(id) ?? 0) + 1);
    if (userId && row.user_id === userId) likedByMe.add(id);
  }

  const commentCount = new Map<string, number>();
  for (const row of (commentsRes.data ?? []) as unknown as Record<string, string>[]) {
    const id = row[column];
    commentCount.set(id, (commentCount.get(id) ?? 0) + 1);
  }

  return { likeCount, commentCount, likedByMe };
}
