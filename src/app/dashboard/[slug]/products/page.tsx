"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { NewProductForm } from "./_components/NewProductForm";

type Prod = {
  id: string;
  title: string;
  price: number;
  media_url: string | null;
  sku: string | null;
  stock: number | null;
  description: string | null;
};

export default function ProductsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Modal de edición
  const [editing, setEditing] = useState<Prod | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);

  // Inputs controlados DEL MODAL (strings)
  const [priceInput, setPriceInput] = useState<string>("");
  const [stockInput, setStockInput] = useState<string>("");
  const [descInput, setDescInput] = useState<string>("");
  const [improvingEdit, setImprovingEdit] = useState(false);

  // ------- DATA LOAD --------
  const fetchProducts = useCallback(
    async (storeUuid: string) => {
      const { data, error } = await supabase
        .from("products")
        .select("id,title,price,media_url,sku,stock,description")
        .eq("store_id", storeUuid)
        .order("created_at", { ascending: false });

      if (error) {
        setErr(error.message);
        setItems([]);
      } else {
        setErr(null);
        setItems((data as Prod[]) ?? []);
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      // 1) Sesión
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?next=/dashboard/${slug}/products`);
        return;
      }

      // 2) storeId por slug
      const { data: store, error: eStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", slug)
        .single();

      if (eStore || !store) {
        setErr("No tienes acceso a esta tienda.");
        setLoading(false);
        return;
      }

      setStoreId(store.id);

      // 3) Productos
      await fetchProducts(store.id);
      setLoading(false);
    })();
  }, [slug, router, fetchProducts]);

  // Refrescar tras crear
  const handleCreated = useCallback(async () => {
    if (storeId) await fetchProducts(storeId);
  }, [storeId, fetchProducts]);

  // Subida de imagen (edición) – CLIENTE
  const uploadEditedImageIfNeeded = useCallback(async (): Promise<string | null> => {
    if (!newImageFile || !storeId) return null;
    const cleanExt =
      newImageFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const fileName = `${storeId}/${crypto.randomUUID()}.${cleanExt}`;

    const { data: up, error: upErr } = await supabase
      .storage
      .from("product-images")
      .upload(fileName, newImageFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (upErr) throw new Error(`No pude subir la nueva imagen: ${upErr.message}`);

    const { data: pub } = supabase
      .storage
      .from("product-images")
      .getPublicUrl(up.path);

    return pub.publicUrl ?? null;
  }, [newImageFile, storeId]);

  // IA para descripción (modal)
  async function improveEditDescription() {
  if (!descInput.trim()) return;

  // 👇 Evita el error: si no hay editing, usa título vacío
  const titleForAI = editing?.title ?? "";

  setImprovingEdit(true);
  try {
    const res = await fetch("/api/ai/improve-product-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: descInput,
        title: titleForAI,         // ← ya no accedemos a editing.title directo
        lang: "es",
        tone: "claro y persuasivo",
      }),
    });

    const json = await res.json();
    if (json.improved) setDescInput(json.improved);
    else if (json.error) alert(json.error);
  } catch (e: any) {
    alert(e?.message || "No se pudo mejorar la descripción.");
  } finally {
    setImprovingEdit(false);
  }
}


  // Guardar edición (UN SOLO UPDATE con cambios)
  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      // 1) Imagen (si hay nueva)
      let mediaUrlToSave: string | undefined;
      if (newImageFile) {
        mediaUrlToSave = await uploadEditedImageIfNeeded() ?? undefined;
      }

      // 2) Parseo seguro
      const priceParsed =
        priceInput.trim() === "" ? undefined : Number(priceInput);
      const stockParsed =
        stockInput.trim() === "" ? undefined : Number(stockInput);

      if (priceParsed !== undefined && (isNaN(priceParsed) || priceParsed < 0)) {
        throw new Error("Precio inválido.");
      }
      if (stockParsed !== undefined && (isNaN(stockParsed) || stockParsed < 0)) {
        throw new Error("Stock inválido.");
      }

      // 3) Construir payload SOLO con cambios
      const updates: Record<string, any> = {};
      if (mediaUrlToSave !== undefined) updates.media_url = mediaUrlToSave;
      if (priceParsed !== undefined && priceParsed !== editing.price)
        updates.price = priceParsed;
      if (stockParsed !== undefined && stockParsed !== editing.stock)
        updates.stock = stockParsed;
      if (descInput !== editing.description)
        updates.description = descInput ?? null;

      // Si no hay cambios, cerrar sin tocar DB
      if (Object.keys(updates).length === 0) {
        setEditing(null);
        setNewImageFile(null);
        setNewImagePreview(null);
        return;
      }

      // 4) Update en DB
      const { error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", editing.id);

      if (error) throw new Error(error.message);

      // 5) Refrescar y limpiar
      if (storeId) await fetchProducts(storeId);
      setEditing(null);
      setNewImageFile(null);
      setNewImagePreview(null);
    } catch (e: any) {
      alert(e?.message || "No se pudo guardar");
    } finally {
      setSavingEdit(false);
    }
  }, [
    editing,
    newImageFile,
    uploadEditedImageIfNeeded,
    priceInput,
    stockInput,
    descInput,
    storeId,
    fetchProducts,
  ]);

  // Eliminar producto
  const handleDelete = useCallback(
    async (productId: string) => {
      if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) {
        alert(error.message);
        return;
      }
      if (storeId) await fetchProducts(storeId);
    },
    [storeId, fetchProducts]
  );

  // Selección de nueva imagen (modal)
  const onSelectNewImage = (file?: File | null) => {
    if (!file) {
      setNewImageFile(null);
      setNewImagePreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("El archivo debe ser una imagen.");
      return;
    }
    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  };

  if (loading) return <p>Cargando…</p>;
  if (err) return <p className="text-red-600">{err}</p>;
  if (!storeId) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">
          Productos — <code>/{slug}</code>
        </h1>
        <div className="flex gap-2">
          <Link href="/dashboard" className="rounded border px-3 py-2">
            ← Mis tiendas
          </Link>
          <Link
            href={`/${slug}`}
            className="rounded border px-3 py-2"
            target="_blank"
          >
            Ver tienda pública ↗
          </Link>
        </div>
      </header>

      {/* Nuevo producto */}
      <section className="max-w-xl rounded border bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold">Nuevo producto</h2>
        <p className="mb-4 text-sm text-gray-600">
          Completa los campos. Puedes subir una imagen (arrastrando el archivo o
          usando el botón) o pegar una URL directa. Los campos marcados con * son obligatorios.
        </p>

        <NewProductForm
          storeId={storeId}
          onCreated={handleCreated}
          onCancel={() => {}}
        />
      </section>

      {/* Listado */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Listado</h2>

        {items.length === 0 ? (
          <div className="rounded border bg-white p-4 text-sm text-gray-600">
            Aún no tienes productos. Crea el primero con el formulario de arriba.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {items.map((p) => (
              <article key={p.id} className="rounded border bg-white p-3">
                {/* Imagen sin recorte */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-gray-100 mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.media_url ?? "https://placehold.co/800x600?text=Sin+imagen"}
                    alt={p.title}
                    className="absolute inset-0 h-full w-full object-contain"
                    loading="lazy"
                  />
                </div>

                <div className="space-y-1">
                  <div className="font-medium" title={p.title}>
                    {p.title}
                  </div>
                  <div className="text-sm opacity-70">SKU: {p.sku ?? "—"}</div>
                  <div className="text-sm">Stock: {typeof p.stock === "number" ? p.stock : 0}</div>
                  <div className="text-lg font-semibold">
                    ${Number(p.price).toFixed(2)}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    onClick={() => {
                      setEditing(p);
                      setNewImageFile(null);
                      setNewImagePreview(null);
                      setPriceInput(p.price != null ? String(p.price) : "0");
                      setStockInput(p.stock != null ? String(p.stock) : "0");
                      setDescInput(p.description ?? "");
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="rounded border px-3 py-1 text-sm hover:bg-red-50 text-red-600 border-red-300"
                    onClick={() => handleDelete(p.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold">Editar producto</h3>

            {/* Vista previa */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  newImagePreview ??
                  editing.media_url ??
                  "https://placehold.co/800x600?text=Sin+imagen"
                }
                alt={editing.title}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>

            {/* Imagen nueva */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Cambiar imagen</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onSelectNewImage(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-gray-500">
                Opcional. Si no eliges archivo, se conserva la imagen actual.
              </p>
            </div>

            {/* Precio */}
            <label className="block text-sm font-medium">
              Precio (MXN)
              <input
                type="number"
                step="0.01"
                min="0"
                className="mt-1 w-full rounded border px-3 py-2"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
              />
            </label>

            {/* Stock */}
            <label className="block text-sm font-medium">
              Stock
              <input
                type="number"
                step="1"
                min="0"
                className="mt-1 w-full rounded border px-3 py-2"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
              />
            </label>

            {/* Descripción + IA */}
            <label className="block text-sm font-medium">
              Descripción
              <textarea
                className="mt-1 w-full rounded border px-3 py-2 min-h-[110px]"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="Descripción del producto…"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={improveEditDescription}
                disabled={!descInput.trim() || improvingEdit}
                className="rounded border px-3 py-1 text-sm disabled:opacity-60"
              >
                {improvingEdit ? "Mejorando..." : "Mejorar con IA"}
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="rounded border px-4 py-2"
                onClick={() => {
                  setEditing(null);
                  setNewImageFile(null);
                  setNewImagePreview(null);
                }}
                disabled={savingEdit}
              >
                Cancelar
              </button>
              <button
                className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
