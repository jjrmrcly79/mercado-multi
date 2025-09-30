"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Store = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      // 1) Verifica sesión
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // 2) Trae tiendas del usuario (owner)
      const { data, error } = await supabase
        .from("stores")
        .select("id, slug, name, logo_url, primary_color, secondary_color")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });

      if (error) setErr(error.message);
      else setStores((data ?? []) as Store[]);

      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="p-6">Cargando dashboard…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis tiendas</h1>
          <p className="text-sm text-gray-500">Administra tus productos y la marca de cada tienda.</p>
        </div>
        <Link
          href="/dashboard/new"
          className="rounded bg-black px-3 py-2 text-white hover:opacity-90"
        >
          + Nueva tienda
        </Link>
      </div>

      {/* Empty state */}
      {stores.length === 0 ? (
        <div className="rounded border bg-white p-6">
          <p className="mb-3">Aún no tienes tiendas.</p>
          <Link href="/dashboard/new" className="underline text-sm">
            Crear la primera tienda →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <div key={s.id} className="rounded border bg-white p-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.logo_url ?? "https://placehold.co/80x80?text=Logo"}
                  alt={s.name}
                  className="h-12 w-12 rounded object-cover"
                />
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-gray-500">/{s.slug}</div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/dashboard/${s.slug}/products`}
                  className="rounded border px-3 py-2 text-sm"
                >
                  Productos
                </Link>
                <Link
                  href={`/dashboard/${s.slug}/settings`}
                  className="rounded border px-3 py-2 text-sm"
                >
                  Settings
                </Link>
                <Link
                  href={`/${s.slug}`}
                  target="_blank"
                  className="ml-auto rounded border px-3 py-2 text-sm"
                >
                  Ver pública ↗
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
