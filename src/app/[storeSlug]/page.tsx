"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useCart } from "@/components/CartProvider";

type Item = { id: string; title: string; price: number; media_url: string | null };

// Cambia este nombre si tu bucket por defecto es otro
const DEFAULT_BUCKET = "products";

/**
 * Convierte lo que venga de la BD (media_url / path) a un URL público.
 * - Si ya es http(s), lo respeta.
 * - Soporta "bucket:path/archivo.jpg" y "bucket/path/archivo.jpg".
 * - Si solo viene un path, usa DEFAULT_BUCKET.
 */
function toPublicUrl(raw: string | null) {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const cleaned = raw.replace(":", "/"); // soporta bucket:path
  const parts = cleaned.split("/");
  let bucket = DEFAULT_BUCKET;
  let path = cleaned;

  // Si viene "bucket/lo-que-sigue", tomamos el bucket explícito
  if (parts.length > 1 && !cleaned.startsWith("/")) {
    bucket = parts[0];
    path = parts.slice(1).join("/");
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export default function StorePage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const cart = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      // 1) obtener storeId vía RPC pública (evita RLS en stores)
      const { data: storeId, error: eId } = await supabase.rpc("store_id_by_slug", { p_slug: storeSlug });
      if (eId || !storeId) {
        setErr("Tienda no encontrada.");
        setItems([]);
        setLoading(false);
        return;
      }

      // 2) productos públicos (la RPC puede devolver media_url, image_path, etc.)
      const { data, error } = await supabase.rpc("public_store_products", { p_store: storeId });
      if (error) {
        setErr(error.message);
        setItems([]);
        setLoading(false);
        return;
      }

      const normalized = (data ?? []).map((p: any) => {
        const raw =
          p.media_url ??
          p.image_url ??
          p.image_path ??
          p.object_path ??
          p.path ??
          null;

        return {
          ...p,
          media_url: toPublicUrl(raw),
          price: Number(p.price),
        } as Item;
      });

      setItems(normalized);
      setLoading(false);
    })();
  }, [storeSlug]);

  function handleAdd(p: Item) {
    cart.addItem({ id: p.id, title: p.title, price: Number(p.price), qty: 1, image: p.media_url });
    setJustAdded(p.id);
    setTimeout(() => setJustAdded(null), 1000); // feedback rápido
  }

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
              src={p.media_url ?? "https://placehold.co/600x400?text=Sin+imagen"}
              alt={p.title}
              className="mb-2 h-40 w-full rounded object-cover"
            />
            <div className="space-y-1">
              <div className="font-medium">{p.title}</div>
              <div className="text-lg font-semibold">${Number(p.price).toFixed(2)}</div>
            </div>
            <button
              className="mt-3 w-full rounded bg-black px-3 py-2 text-white"
              onClick={() => handleAdd(p)}
            >
              {justAdded === p.id ? "✔ Añadido" : "Add to cart"}
            </button>
          </div>
        ))}
      </div>

      <Link href={`/dashboard/${storeSlug}/products`} className="text-sm underline">
        Soy el dueño — ir al dashboard
      </Link>
    </div>
  );
}
