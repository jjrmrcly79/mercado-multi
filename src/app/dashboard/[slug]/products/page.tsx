"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Prod = {
  id: string;
  title: string;
  price: number;
  media_url: string | null;
  sku: string | null;
  stock: number | null;
};

export default function ProductsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // 1) verifica sesión
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      // 2) busca storeId por slug (RLS garantizará que seas miembro)
      const { data: store, error: eStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", slug)
        .single();
      if (eStore || !store) { setErr("No tienes acceso a esta tienda."); setLoading(false); return; }
      setStoreId(store.id);

      // 3) trae productos + primer media + primera variante
      const { data, error } = await supabase.rpc("dashboard_products_list", { p_store: store.id });
      if (error) setErr(error.message);
      else setItems(data as Prod[]);

      setLoading(false);
    })();
  }, [slug, router]);

  if (loading) return <p>Cargando…</p>;
  if (err) return <p className="text-red-600">{err}</p>;
  if (!storeId) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Productos — <code>/{slug}</code></h1>
      <div className="flex gap-2">
        <Link href="/dashboard" className="rounded border px-3 py-2">← Mis tiendas</Link>
        <Link href={`/dashboard/${slug}/products/new`} className="rounded bg-black px-3 py-2 text-white">Nuevo producto</Link>
        <Link href={`/${slug}`} className="rounded border px-3 py-2" target="_blank">Ver tienda pública ↗</Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className="rounded border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.media_url ?? "https://placehold.co/600x400?text=No+image"} alt={p.title} className="mb-2 h-40 w-full rounded object-cover" />
            <div className="space-y-1">
              <div className="font-medium">{p.title}</div>
              <div className="text-sm opacity-70">SKU: {p.sku ?? "-"}</div>
              <div className="text-sm">Stock: {p.stock ?? 0}</div>
              <div className="text-lg font-semibold">${Number(p.price).toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
