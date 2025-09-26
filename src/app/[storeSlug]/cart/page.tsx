"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useCart } from "@/components/CartProvider";

export default function CartPage({ params }: { params: { storeSlug: string } }) {
  const { storeSlug } = params;
  const { items, setQty, removeItem, subtotal, total } = useCart();

  if (!items.length) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Carrito</h1>
        <p>Tu carrito está vacío.</p>
        <Link href={`/${storeSlug}`} className="underline">Volver a la tienda</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Carrito</h1>

      <div className="space-y-3">
        {items.map((x) => (
          <div key={x.id} className="flex items-center gap-3 rounded border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.image ?? "https://placehold.co/100x100?text=No+image"} alt={x.title} className="h-16 w-16 rounded object-cover" />
            <div className="flex-1">
              <div className="font-medium">{x.title}</div>
              <div className="text-sm">${x.price.toFixed(2)}</div>
            </div>
            <input
              type="number"
              min={1}
              value={x.qty}
              onChange={(e)=>setQty(x.id, Math.max(1, parseInt(e.target.value||"1")))}
              className="w-16 rounded border px-2 py-1"
            />
            <button className="rounded border px-3 py-1" onClick={()=>removeItem(x.id)}>Eliminar</button>
          </div>
        ))}
      </div>

      {/* Resumen + botón de pago */}
      <div className="rounded border bg-white p-3">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <CheckoutButton />
      </div>

      <Link href={`/${storeSlug}`} className="text-sm underline">Seguir comprando</Link>
    </div>
  );
}

/* === AQUÍ ABAJO ESTÁ EL COMPONENTE CheckoutButton === */
function CheckoutButton() {
  const { items } = useCart();
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function goCheckout() {
    try {
      setLoading(true); setErr(null);
      const payload = {
        storeSlug,
        items: items.map(x => ({ id: x.id, qty: x.qty })),
      };
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear la sesión");
      window.location.href = data.url; // redirige a Stripe
    } catch (e: any) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="mt-3 w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        disabled={loading || !items.length}
        onClick={goCheckout}
      >
        {loading ? "Redirigiendo..." : "Pagar con Stripe"}
      </button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </>
  );
}
