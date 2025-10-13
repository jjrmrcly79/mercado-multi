"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SuccessPage() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [order, setOrder] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/orders?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "No se pudo cargar la orden");
        setOrder(data);
      } catch (e: any) {
        setErr(e.message || "Error");
      }
    })();
  }, [sessionId]);

  if (!sessionId) return <div className="p-6">Falta session_id</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!order) return <div className="p-6">Cargando…</div>;

  return (
    <div className="max-w-xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold mb-3">✅ Pago exitoso</h1>
      <p className="mb-2">Folio de pedido: <strong>{order.number}</strong></p>
      <p className="mb-2">Correo: {order.email}</p>
      <p className="mb-6">Total: {order.currency || "MXN"} {Number(order.total).toFixed(2)}</p>
      <a href={`/${order.store_slug || ""}`} className="underline">Regresar a la tienda</a>
    </div>
  );
}

