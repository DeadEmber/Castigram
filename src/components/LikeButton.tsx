"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Botón de "me gusta" para un bando o un post.
export function LikeButton({
  target,
  targetId,
  initialCount,
  initiallyLiked,
  loggedIn,
}: {
  target: "bando" | "post";
  targetId: string;
  initialCount: number;
  initiallyLiked: boolean;
  loggedIn: boolean;
}) {
  const supabase = createClient();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initiallyLiked);
  const [busy, setBusy] = useState(false);

  const column = target === "bando" ? "bando_id" : "post_id";

  async function toggle() {
    if (!loggedIn) {
      window.location.href = "/login";
      return;
    }
    if (busy) return;
    setBusy(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }

    // Optimista.
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));

    if (liked) {
      await supabase
        .from("likes")
        .delete()
        .eq("user_id", user.id)
        .eq(column, targetId);
    } else {
      await supabase
        .from("likes")
        .insert({ user_id: user.id, [column]: targetId });
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 text-sm ${
        liked ? "text-red-600" : "text-stone-500 hover:text-red-600"
      }`}
      aria-pressed={liked}
    >
      <Heart className="h-5 w-5" fill={liked ? "currentColor" : "none"} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
