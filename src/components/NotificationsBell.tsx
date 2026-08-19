"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@/lib/supabase/types";

export function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Cerrar el panel al hacer clic fuera.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setItems(data ?? []);
      // Marcar todas como leídas.
      if (unread > 0) {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("read", false);
        setUnread(0);
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative rounded-full p-2 text-stone-600 hover:bg-brand-100"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-lg">
          <div className="border-b border-brand-100 px-4 py-2 text-sm font-semibold text-stone-700">
            Notificaciones
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-stone-400">
              No tienes notificaciones.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-brand-50 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "#"}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-brand-50"
                  >
                    <p className="text-sm font-medium text-stone-800">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-stone-400">
                      {timeAgo(n.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
