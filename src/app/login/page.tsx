import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";

const pueblo = process.env.NEXT_PUBLIC_PUEBLO ?? "tu pueblo";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-6 max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo className="h-14 w-14" />
        <h1 className="mt-3 font-display text-2xl font-semibold text-brand-800">
          Castigram
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          El bando digital de {pueblo}. Entra para participar en el muro y el
          mercadillo.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
