"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    // usa el callback de servidor, NO el dashboard
    emailRedirectTo: `http://localhost:3000/auth/complete`,
  },
});

    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Login</h1>
      {sent ? (
        <p>Te enviamos un enlace a <b>{email}</b>. Revisa tu correo.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            className="w-full rounded border px-3 py-2"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="rounded bg-black px-3 py-2 text-white">Enviar enlace</button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
