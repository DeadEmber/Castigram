import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { NewBandoForm } from "@/components/NewBandoForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/admin");

  // Solo el ayuntamiento (admin) puede entrar aquí.
  if (profile?.role !== "admin") {
    return (
      <div className="card p-8 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-brand-300" />
        <h1 className="mt-3 font-display text-xl font-semibold text-brand-800">
          Zona del ayuntamiento
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Solo las cuentas de administrador pueden publicar bandos oficiales.
          Si eres del ayuntamiento, pide que activen tu cuenta como
          administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-brand-600" />
        <h1 className="font-display text-2xl font-semibold text-brand-800">
          Publicar un bando
        </h1>
      </div>
      <p className="-mt-2 text-sm text-stone-500">
        Este aviso se mostrará a todo el pueblo en la portada.
      </p>
      <NewBandoForm userId={user.id} />
    </div>
  );
}
