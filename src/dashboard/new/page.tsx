"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function NewStorePage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error } = await supabase.from("stores").insert({
      name,
      slug,
      owner_id: user.id,
    });
    if (error) setError(error.message);
    else router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md space-y-3">
      <h1 className="text-2xl font-semibold">Crear tienda</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded border px-3 py-2" placeholder="Nombre" value={name} onChange={e=>setName(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="slug-ejemplo" value={slug} onChange={e=>setSlug(e.target.value)} />
        <button className="rounded bg-black px-3 py-2 text-white">Crear</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
