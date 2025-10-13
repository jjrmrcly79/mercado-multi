"use client";

import { useCart } from "@/components/CartProvider";
import Link from "next/link";

export default function CartPage({
  params,
}: {
  params: { storeSlug: string };
}) {
  const { items, subtotal, total, setQty, removeItem, storeSlug } = useCart();

  // Defensa por si alguien entra con un slug distinto al del provider
  if (storeSlug !== params.storeSlug) {
    return (
      <div className="p-6 text-red-600">
        Slug de tienda no coincide con el contexto.
      </div>
    );
  }

  const checkout = async () => {
    if (items.length === 0) return;
    const body = {
      storeSlug,
      items: items.map((i) => ({ id: i.id, qty: i.qty })),
    };
    const res = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok && data?.url) {
      window.location.href = data.url;
    } else {
      alert(data?.error || "No se pudo crear la sesión de pago");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Tu carrito</h1>

      {items.length === 0 ? (
        <div>
          <p className="mb-4">Aún no tienes productos en el carrito.</p>
          <Link href={`/${storeSlug}`} className="underline">
            ← Seguir comprando
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-4 mb-6">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between border p-3 rounded"
              >
                <div>
                  <div className="font-medium">{it.title}</div>
                  <div className="text-sm opacity-70">${it.price.toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => setQty(it.id, Math.max(1, it.qty - 1))}
                  >
                    −
                  </button>
                  <span className="w-8 text-center">{it.qty}</span>
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => setQty(it.id, it.qty + 1)}
                  >
                    +
                  </button>
                  <button
                    className="ml-3 text-red-600 underline"
                    onClick={() => removeItem(it.id)}
                  >
                    quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-lg mb-6">
            <div>Subtotal:</div>
            <div>${subtotal.toFixed(2)}</div>
          </div>
          <div className="flex items-center justify-between text-xl font-semibold mb-8">
            <div>Total:</div>
            <div>${total.toFixed(2)}</div>
          </div>

          <div className="flex gap-3">
            <Link href={`/${storeSlug}`} className="px-4 py-2 border rounded">
              ← Seguir comprando
            </Link>
            <button
              onClick={checkout}
              className="px-4 py-2 bg-black text-white rounded"
            >
              Ir a pagar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
