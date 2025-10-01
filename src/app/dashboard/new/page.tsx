 "use client";
 import { useState } from "react";
 import { useRouter } from "next/navigation";
 import { createStoreWithLogo, generateBrandAndPalette } from "./actions";
 import { supabase } from "@/lib/supabase/client";

 export default function NewStorePage() {
   const router = useRouter();
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const s = (v: FormDataEntryValue | null) => (v == null ? "" : String(v));

   async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
     e.preventDefault();
     setError(null);
     setLoading(true);

     const fd = new FormData(e.currentTarget);

    // ⛑️ Fallback: adjunta el access_token por si el server no ve la cookie
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      fd.set("access_token", session.access_token);
    }

     // 1) crear tienda + subir logo
     const res = await createStoreWithLogo(fd);
     if (!res.ok) {
       setLoading(false);
       setError(res.error || "No se pudo crear la tienda.");
       return;
     }

     // 2) generar identidad
     await generateBrandAndPalette({
       storeId: res.storeId,
       name: s(fd.get("name")),
       brandDescription: s(fd.get("brand_description")),
       brandAudience: s(fd.get("brand_audience")),
       brandTone: s(fd.get("brand_tone")),
       logoUrl: res.logoUrl ?? null,
     });

     setLoading(false);
     router.push(`/dashboard/${res.slug}/products`);
   }



  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Crear tienda</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded border px-3 py-2" name="name" placeholder="Mi Tienda" required />
        <input className="w-full rounded border px-3 py-2 lowercase" name="slug" placeholder="mitienda"
               pattern="^[a-z0-9-]+$" title="Solo minúsculas, números y guiones" required />
        <input className="w-full rounded border px-3 py-2" type="file" name="logo" accept="image/*" />
        <textarea className="w-full rounded border px-3 py-2" name="brand_description" placeholder="Describe tu marca…" />
        <input className="w-full rounded border px-3 py-2" name="brand_audience" placeholder="Público objetivo" />
        <select name="brand_tone" className="w-full rounded border px-3 py-2">
          <option value="">Tono de voz (opcional)</option>
          <option value="cercano">Cercano</option>
          <option value="profesional">Profesional</option>
          <option value="premium">Premium</option>
          <option value="divertido">Divertido</option>
          <option value="técnico">Técnico</option>
        </select>

        <button className="rounded bg-black px-3 py-2 text-white disabled:opacity-50" disabled={loading}>
          {loading ? "Creando..." : "Crear"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}

