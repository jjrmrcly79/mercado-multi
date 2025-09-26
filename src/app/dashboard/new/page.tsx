"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function NewStorePage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { error } = await supabase.from("stores").insert({
        name,
        slug,          // único por tienda
        owner_id: user.id,
      });

      if (error) setError(error.message);
      else router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Crear tienda</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Nombre (ej. Mi Tienda)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="slug (ej. mitienda)"
          value={slug}
          onChange={(e) => setSlug(e.target.value.replace(/\s+/g, '-').toLowerCase())}
          pattern="^[a-z0-9-]+$"
          title="Solo minúsculas, números y guiones"
          required
        />
        <button
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Creando..." : "Crear"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
