"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function NewProduct() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState<number>(0);
  const [image, setImage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: store } = await supabase.from("stores").select("id").eq("slug", slug).single();
      setStoreId(store?.id ?? null);
    })();
  }, [slug, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    setError(null); setLoading(true);
    try {
      // 1) producto base
      const { data: prod, error: eProd } = await supabase
        .from("products")
        .insert({ store_id: storeId, title, price, status: "active" })
        .select("id")
        .single();
      if (eProd) throw eProd;

      // 2) variante principal
      if (sku) {
        const { error: eVar } = await supabase.from("variants").insert({
          product_id: prod.id, sku, price, stock, weight_gr: 0, options: []
        });
        if (eVar) throw eVar;
      }

      // 3) imagen (opcional)
if (image) {
      const { error: eImg } = await supabase.from("media").insert({
        product_id: prod.id, url: image, alt: title, sort: 0
      });
      if (eImg) throw eImg;
    }

    router.replace(`/dashboard/${slug}/products`);
  } catch (e) {
    if (e instanceof Error) {
      setError(e.message);
    } else {
      setError("An unknown error occurred");
    }
  } finally {
    setLoading(false);
  }
}

  if (!storeId) return <p>Cargando…</p>;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Nuevo producto</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded border px-3 py-2" placeholder="Título" value={title} onChange={(e)=>setTitle(e.target.value)} required />
        <input type="number" step="0.01" className="w-full rounded border px-3 py-2" placeholder="Precio" value={price} onChange={(e)=>setPrice(parseFloat(e.target.value||"0"))} required />
        <input className="w-full rounded border px-3 py-2" placeholder="SKU (opcional)" value={sku} onChange={(e)=>setSku(e.target.value)} />
        <input type="number" className="w-full rounded border px-3 py-2" placeholder="Stock (si pones SKU)" value={stock} onChange={(e)=>setStock(parseInt(e.target.value||"0"))} />
        <input className="w-full rounded border px-3 py-2" placeholder="URL de imagen (opcional)" value={image} onChange={(e)=>setImage(e.target.value)} />
        <div className="flex gap-2">
          <button className="rounded bg-black px-3 py-2 text-white disabled:opacity-50" disabled={loading}>{loading ? "Guardando..." : "Crear"}</button>
          <button type="button" className="rounded border px-3 py-2" onClick={()=>router.back()}>Cancelar</button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
