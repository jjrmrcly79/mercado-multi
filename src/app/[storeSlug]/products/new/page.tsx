"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const BUCKET = "products";

export default function NewProductPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const router = useRouter();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // 1) Traer storeId desde el slug vía RPC
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.rpc("store_id_by_slug", { p_slug: storeSlug });
      if (!mounted) return;
      if (error || !data) {
        setErr(error?.message ?? "No se encontró la tienda.");
      } else {
        setStoreId(String(data));
      }
    })();
    return () => { mounted = false; };
  }, [storeSlug]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!storeId) return setErr("Tienda no encontrada.");
    if (!title.trim()) return setErr("Escribe el nombre del producto.");
    const priceNumber = Number(price);
    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      return setErr("Precio inválido.");
    }
    if (!file) return setErr("Selecciona una imagen.");

    setSubmitting(true);
    try {
      // 2) Subir imagen a Storage
      const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
      const objectPath = `${storeId}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;

      // 3) Insertar producto en la tabla
      // Ajusta los nombres de columnas si tu esquema difiere.
      const { error: insErr } = await supabase
        .from("products")
        .insert({
          title,
          price: priceNumber,
          store_id: storeId,
          bucket: BUCKET,       // si no tienes estas columnas, quítalas o cambia nombres
          object_path: objectPath,
          // Si tu tabla usa `media_url` en lugar de bucket/path, podrías guardar aquí:
          // media_url: `${BUCKET}/${objectPath}`,
        });

      if (insErr) throw insErr;

      setOk("Producto creado ✅");
      // 4) Redirigir al dashboard/lista (ajusta la ruta si usas otra)
      router.push(`/dashboard/${storeSlug}/products`);
    } catch (e: any) {
      setErr(e?.message ?? "Error creando el producto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Nuevo producto</h1>
        <p className="text-sm text-gray-600">Tienda /{storeSlug}</p>
      </div>

      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{err}</p>}
      {ok && <p className="rounded border border-green-200 bg-green-50 p-3 text-green-700">{ok}</p>}

      <form onSubmit={onSubmit} className="space-y-4 rounded border bg-white p-4">
        <div className="grid gap-3">
          <label className="text-sm font-medium">Nombre</label>
          <input
            className="rounded border px-3 py-2"
            placeholder="Ej. Wireless Headset X1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid gap-3">
          <label className="text-sm font-medium">Precio</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="rounded border px-3 py-2"
            placeholder="1299.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className="grid gap-3">
          <label className="text-sm font-medium">Imagen</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded border px-3 py-2"
          />
          {file && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={URL.createObjectURL(file)}
              alt="preview"
              className="h-40 w-full rounded object-cover"
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || !storeId}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "Guardando..." : "Crear producto"}
          </button>
          <Link
            href={`/dashboard/${storeSlug}/products`}
            className="rounded border px-4 py-2"
          >
            Cancelar
          </Link>
        </div>
      </form>

      <div className="text-sm text-gray-600">
        <p>• Las imágenes se suben al bucket <code>{BUCKET}</code> con ruta <code>storeId/uuid-nombre</code>.</p>
        <p>• Asegúrate de que el bucket sea público (o usa signed URLs en el cliente).</p>
      </div>
    </div>
  );
}
