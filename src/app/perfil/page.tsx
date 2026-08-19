import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/perfil");
  if (!profile) redirect("/login");

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-brand-800">
        Mi perfil
      </h1>
      <ProfileForm profile={profile} />
    </div>
  );
}
