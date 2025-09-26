import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

async function fetchData(storeSlug: string) {
  // ⚠️ Server Components no pueden usar nuestro cliente de browser directo.
  // Solución rápida: usar el endpoint público vía fetch (haremos una API),
  // o convertir esta página en "use client".
  // Para ir rápido, la hacemos client en esta primera versión.
  return null as any;
}

export default function StorePage({ params }: { params: { storeSlug: string } }) {
  return <StoreClient storeSlug={params.storeSlug} />;
}

// --- Client version (simple y efectiva) ---
"use client";
import { useEffect, useState } from "react";

function StoreClient({ storeSlug }: { storeSlug: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 1) obtener storeId por slug
      const { data: store } = await supabase.from("stores").select("id").eq("slug", storeSlug).single();
      if (!store) { setItems([]); setLoading(false); return; }

      // 2) traer productos activos con imagen
      const { data, error } = await supabase.rpc("public_store_products", { p_store: store.id });
      setItems(error ? [] : (data as any[]));
      setLoading(false);
    })();
  }, [storeSlug]);

  if (loading) return <p>Cargando tienda…</p>;
  if (!items.length) return <p>Sin productos aún.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tienda /{storeSlug}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className="rounded border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.media_url ?? "https://placehold.co/600x400?text=No+image"} alt={p.title} className="mb-2 h-40 w-full rounded object-cover" />
            <div className="space-y-1">
              <div className="font-medium">{p.title}</div>
              <div className="text-lg font-semibold">${Number(p.price).toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
      <Link href={`/dashboard/${storeSlug}/products`} className="text-sm underline">Soy el dueño — ir al dashboard</Link>
    </div>
  );
}
