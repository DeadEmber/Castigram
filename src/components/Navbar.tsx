import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "./Logo";
import { NavTabs } from "./NavTabs";
import { NotificationsBell } from "./NotificationsBell";
import { Avatar } from "./Avatar";

const pueblo = process.env.NEXT_PUBLIC_PUEBLO ?? "";

// Cabecera + barra inferior de pestañas. Es un Server Component: lee la sesión.
export async function Navbar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let unread = 0;
  if (user) {
    const [{ data: p }, { count }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false),
    ]);
    profile = p;
    unread = count ?? 0;
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-brand-100 bg-brand-50/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <div className="leading-tight">
              <span className="block font-display text-lg font-semibold text-brand-800">
                Castigram
              </span>
              {pueblo && (
                <span className="block text-xs text-stone-500">{pueblo}</span>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-1">
            {user ? (
              <>
                <NotificationsBell initialUnread={unread} />
                <Link href="/perfil" aria-label="Mi perfil">
                  <Avatar
                    name={profile?.full_name ?? "Vecino"}
                    url={profile?.avatar_url}
                    size={34}
                  />
                </Link>
              </>
            ) : (
              <Link href="/login" className="btn-primary">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <NavTabs isAdmin={profile?.role === "admin"} loggedIn={!!user} />
    </>
  );
}
