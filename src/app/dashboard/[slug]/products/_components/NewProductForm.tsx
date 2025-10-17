"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

export function NewProductForm({
  storeId,
  onCreated,
  onCancel,
}: {
  storeId: string;
  onCreated?: () => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("0");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState<string>("0");
  const [description, setDescription] = useState<string>(""); // 👈 NEW
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [improving, setImproving] = useState(false); // 👈 NEW
  const dropRef = useRef<HTMLDivElement | null>(null);

  function onFileSelected(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    setError(null);
    setImageFile(file);
    setImageUrlInput("");
    const url = URL.createObjectURL(file);
    setPreview(url);
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    onFileSelected(e.dataTransfer.files?.[0]);
  }

  async function improveDescription() {
    if (!description.trim()) return;
    setImproving(true);
    try {
      const res = await fetch("/api/ai/improve-product-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: description, title, lang: "es", tone: "claro y persuasivo" }),
      });
      const json = await res.json();
      if (json.improved) setDescription(json.improved);
      else if (json.error) setError(json.error);
    } catch (e: any) {
      setError(e?.message || "No se pudo mejorar la descripción.");
    } finally {
      setImproving(false);
    }
  }

  async function uploadIfNeeded(): Promise<string | null> {
    if (imageFile && imageFile.size > 0) {
      const ext = imageFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const fileName = `${storeId}/${crypto.randomUUID()}.${ext}`;
      const { data: up, error: upErr } = await supabase
        .storage.from("product-images")
        .upload(fileName, imageFile, { cacheControl: "3600", upsert: false });
      if (upErr) throw new Error(`No pude subir la imagen: ${upErr.message}`);
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(up.path);
      return pub.publicUrl ?? null;
    }
    if (imageUrlInput.trim()) return imageUrlInput.trim();
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const finalUrl = await uploadIfNeeded();
      const { error: insErr } = await supabase.from("products").insert({
        store_id: storeId,
        title,
        price: Number(price),
        sku: sku || null,
        stock: Number(stock),
        media_url: finalUrl || null,
        description: description || null, // 👈 NEW
        is_active: true,
      });
      if (insErr) throw new Error(insErr.message);

      // Reset
      setTitle(""); setPrice("0"); setSku(""); setStock("0");
      setDescription(""); // 👈
      setImageFile(null); setPreview(null); setImageUrlInput("");
      onCreated?.();
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear el producto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Título *</label>
        <input
          aria-label="Título del producto"
          placeholder="Ej. Audífonos inalámbricos"
          className="w-full rounded border px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-gray-500">Nombre visible del producto.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Precio (MXN) *</label>
          <input
            type="number" step="0.01" min="0"
            className="w-full rounded border px-3 py-2"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-gray-500">Usa punto decimal. Ej: 249.90</p>
        </div>
        <div>
          <label className="block text-sm font-medium">Inventario *</label>
          <input
            type="number" step="1" min="0"
            className="w-full rounded border px-3 py-2"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-gray-500">Cantidad disponible.</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">SKU (opcional)</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="Ej. AUD-Z2-BLK"
        />
        <p className="mt-1 text-xs text-gray-500">Identificador interno.</p>
      </div>

      {/* Descripción + IA */}
      <div>
        <label className="block text-sm font-medium">Descripción</label>
        <textarea
          className="w-full rounded border px-3 py-2 min-h-[110px]"
          placeholder="Materiales, medidas, compatibilidad, beneficios, etc."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-500">
        💡 Tip: Incluye una palabra que describa el tipo de producto
        (por ejemplo: “perfume floral”, “suplemento de hongo melena de león”, “aceite esencial de lavanda”)
        para que la IA entienda mejor el contexto.
        </p>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={improveDescription}
            disabled={!description.trim() || improving}
            className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          >
            {improving ? "Mejorando..." : "Mejorar con IA"}
          </button>
        </div>
      </div>

      {/* Imagen: archivo o URL */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Imagen del producto</label>
        <div
          ref={dropRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="rounded border border-dashed p-4 text-center"
        >
          {preview ? (
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Vista previa" className="h-32 object-contain" />
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Arrastra una imagen aquí o usa el botón “Seleccionar”.
            </p>
          )}
          <div className="mt-2">
            <input
              type="file" accept="image/*" aria-label="Seleccionar imagen"
              onChange={(e) => onFileSelected(e.target.files?.[0] ?? undefined)}
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500">O pega una URL (opcional):</p>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="https://.../producto.jpg"
            value={imageUrlInput}
            onChange={(e) => { setImageUrlInput(e.target.value); setImageFile(null); setPreview(null); }}
          />
        </div>

        <p className="text-xs text-gray-500">JPG/PNG/WEBP. Recomendado 1200×1200.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button disabled={loading} className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
          {loading ? "Creando..." : "Crear"}
        </button>
        <button type="button" onClick={onCancel} className="rounded border px-4 py-2">
          Cancelar
        </button>
      </div>
    </form>
  );
}
