"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";

type CreateProductInput = {
  storeId: string;
  title: string;
  price: number;
  sku?: string | null;
  stock: number;
  mediaUrl?: string | null; // ← usamos media_url para coincidir con tu listado
};

export async function createProductAction(input: CreateProductInput) {
  const supabase = await getServerSupabase();

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "El título es obligatorio." };

  const price = Number(input.price);
  const stock = Number.isFinite(input.stock) ? Number(input.stock) : 0;

  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Precio inválido." };
  }
  if (stock < 0) {
    return { ok: false, error: "Inventario inválido." };
  }

  const { error: insErr } = await supabase.from("products").insert({
    store_id: input.storeId,
    title,
    price,
    sku: input.sku || null,
    stock,
    media_url: input.mediaUrl || null, // ← coincide con tu card/RPC
    is_active: true, // existe por el SQL de arriba
  });

  if (insErr) return { ok: false, error: insErr.message };

  // OJO: si tu ruta usa slug, no pasa nada por revalidar con storeId;
  // si prefieres, puedes revalidar /dashboard/[slug]/products desde la página.
  revalidatePath(`/dashboard/${input.storeId}/products`);
  return { ok: true };
}
export async function updateProductAction({
  productId,
  price,
  stock,
  mediaUrl,
}: {
  productId: string;
  price?: number;
  stock?: number;
  mediaUrl?: string | null;
}) {
  const supabase = await getServerSupabase();

  const updates: Record<string, any> = {};
  if (typeof price === "number") updates.price = price;
  if (typeof stock === "number") updates.stock = stock;
  if (mediaUrl !== undefined) updates.media_url = mediaUrl;

  const { error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", productId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
