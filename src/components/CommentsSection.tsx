"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";
import { timeAgo } from "@/lib/format";
import type { Comment, Profile } from "@/lib/supabase/types";

type CommentWithAuthor = Comment & { author: Pick<Profile, "full_name" | "avatar_url"> | null };

export function CommentsSection({
  target,
  targetId,
  loggedIn,
  currentUserId,
}: {
  target: "bando" | "post";
  targetId: string;
  loggedIn: boolean;
  currentUserId: string | null;
}) {
  const supabase = createClient();
  const column = target === "bando" ? "bando_id" : "post_id";

  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("comments")
      .select("*, author:profiles(full_name, avatar_url)")
      .eq(column, targetId)
      .order("created_at", { ascending: true });
    setComments((data as unknown as CommentWithAuthor[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !currentUserId) return;
    setSending(true);
    const { error } = await supabase.from("comments").insert({
      author_id: currentUserId,
      [column]: targetId,
      body: text.trim(),
    });
    if (!error) {
      setText("");
      await load();
    }
    setSending(false);
  }

  async function remove(id: string) {
    await supabase.from("comments").delete().eq("id", id);
    setComments((c) => c.filter((x) => x.id !== id));
  }

  return (
    <div className="mt-3 border-t border-brand-50 pt-3">
      {loading ? (
        <p className="text-sm text-stone-400">Cargando comentarios…</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Link href={`/vecino/${c.author_id}`}>
                <Avatar
                  name={c.author?.full_name ?? "Vecino"}
                  url={c.author?.avatar_url}
                  size={28}
                />
              </Link>
              <div className="flex-1 rounded-2xl bg-brand-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/vecino/${c.author_id}`}
                    className="text-sm font-semibold text-stone-800 hover:text-brand-700 hover:underline"
                  >
                    {c.author?.full_name ?? "Vecino"}
                  </Link>
                  <span className="text-[11px] text-stone-400">
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-stone-700">
                  {c.body}
                </p>
              </div>
              {c.author_id === currentUserId && (
                <button
                  onClick={() => remove(c.id)}
                  className="text-stone-300 hover:text-red-500"
                  aria-label="Borrar comentario"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-stone-400">Sé el primero en comentar.</p>
          )}
        </ul>
      )}

      {loggedIn ? (
        <form onSubmit={send} className="mt-3 flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="Escribe un comentario…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="btn-primary shrink-0 !px-3"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-stone-400">
          <a href="/login" className="text-brand-700 underline">
            Entra
          </a>{" "}
          para comentar.
        </p>
      )}
    </div>
  );
}
