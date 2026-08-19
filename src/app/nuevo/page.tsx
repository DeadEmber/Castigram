import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Composer } from "@/components/Composer";

export const dynamic = "force-dynamic";

export default async function NuevoPage({
  searchParams,
}: {
  searchParams: { tipo?: string };
}) {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/nuevo");

  const defaultTab = searchParams.tipo === "anuncio" ? "anuncio" : "muro";

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-brand-800">
        Publicar
      </h1>
      <Composer userId={user.id} defaultTab={defaultTab} />
    </div>
  );
}
