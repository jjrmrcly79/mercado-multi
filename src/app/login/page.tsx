// src/app/login/page.tsx
"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = useSearchParams();

  // URL pública ya existente en tu código (ajusta si tu archivo lo define distinto)
  const SITE =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const next = useMemo(() => {
    const n = search.get("next");
    // fallback seguro
    return n && n.startsWith("/") ? n : "/dashboard";
  }, [search]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // MUY IMPORTANTE: mandar next para aterrizar después del login
        emailRedirectTo: `${SITE}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <h1 className="text-2xl font-bold">Entrar</h1>
      {sent ? (
        <p>Revisa tu correo para completar el acceso.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded border px-3 py-2"
          />
          <button className="rounded bg-black px-4 py-2 text-white">Enviar enlace</button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </main>
  );
}
