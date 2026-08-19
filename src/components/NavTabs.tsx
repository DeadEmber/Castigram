"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, Users, ShoppingBag, Plus, ShieldCheck } from "lucide-react";

const tabs = [
  { href: "/", label: "Bandos", icon: Megaphone, exact: true },
  { href: "/muro", label: "Muro", icon: Users, exact: false },
  { href: "/mercadillo", label: "Mercadillo", icon: ShoppingBag, exact: false },
];

// Barra inferior de pestañas (estilo app móvil).
export function NavTabs({
  isAdmin,
  loggedIn,
}: {
  isAdmin: boolean;
  loggedIn: boolean;
}) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-stretch justify-around px-2">
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                active ? "text-brand-700" : "text-stone-500"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}

        {loggedIn && (
          <Link
            href={isAdmin ? "/admin" : "/nuevo"}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-brand-700"
          >
            {isAdmin ? (
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
            ) : (
              <Plus className="h-5 w-5" strokeWidth={2} />
            )}
            {isAdmin ? "Ayto." : "Publicar"}
          </Link>
        )}
      </div>
    </nav>
  );
}
