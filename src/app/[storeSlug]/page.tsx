"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Item = { id: string; title: string; price: number; media_url: string | null };

export default function StorePage({ params }: { params: { storeSlug: string } }) {
  const storeSlug = params.storeSlug;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);

      // 1) obtener storeId vía RPC pública (evita RLS en stores)
      const { data: storeId, error: eId } = await supabase
        .rpc("store_id_by_slug", { p_slug: storeSlug });

      if (eId || !storeId) {
        setErr("Tienda no encontrada."); setItems([]); setLoading(false);
        return;
      }

      // 2) traer productos públicos de esa tienda
      const { data, error } = await supabase
        .rpc("public_store_products", { p_store: storeId });

      if (error) { setErr(error.message); setItems([]); }
      else setItems((data ?? []) as Item[]);

      setLoading(false);
    })();
  }, [storeSlug]);

  if (loading) return <p style={{ padding: 16 }}>Cargando tienda…</p>;
  if (err) return <p style={{ padding: 16 }} className="text-red-600">{err}</p>;
  if (!items.length) return <p style={{ padding: 16 }}>Sin productos aún.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tienda /{storeSlug}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className="rounded border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.media_url ?? "https://placehold.co/600x400?text=No+image"}
              alt={p.title}
              className="mb-2 h-40 w-full rounded object-cover"
            />
            <div className="space-y-1">
              <div className="font-medium">{p.title}</div>
              <div className="text-lg font-semibold">${Number(p.price).toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
      <Link href={`/dashboard/${storeSlug}/products`} className="text-sm underline">
        Soy el dueño — ir al dashboard
      </Link>
    </div>
  );
}
