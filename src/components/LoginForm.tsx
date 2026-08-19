"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "entrar" | "registro";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (mode === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(traducir(error.message));
      else {
        router.push(next);
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() || undefined } },
      });
      if (error) setError(traducir(error.message));
      else if (data.session) {
        router.push(next);
        router.refresh();
      } else {
        setInfo(
          "Te hemos enviado un correo de confirmación. Ábrelo para activar tu cuenta."
        );
      }
    }
    setLoading(false);
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex rounded-full bg-brand-100 p-1 text-sm font-medium">
        {(["entrar", "registro"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
            className={`flex-1 rounded-full py-1.5 transition-colors ${
              mode === m ? "bg-white text-brand-800 shadow-sm" : "text-stone-500"
            }`}
          >
            {m === "entrar" ? "Entrar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "registro" && (
          <div>
            <label className="label" htmlFor="name">
              Nombre y apellidos
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. María García"
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {info}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading
            ? "Un momento…"
            : mode === "entrar"
              ? "Entrar"
              : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}

// Traduce los mensajes de error más comunes de Supabase.
function traducir(msg: string): string {
  if (/invalid login credentials/i.test(msg))
    return "Correo o contraseña incorrectos.";
  if (/user already registered/i.test(msg))
    return "Ya existe una cuenta con ese correo. Prueba a entrar.";
  if (/password should be at least/i.test(msg))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (/email not confirmed/i.test(msg))
    return "Aún no has confirmado tu correo. Revisa tu bandeja de entrada.";
  return msg;
}
