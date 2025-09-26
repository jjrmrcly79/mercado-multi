"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function SuccessPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");
  const [msg, setMsg] = useState("Validando pago...");

  useEffect(() => {
    // Aquí luego validamos la sesión o mostramos detalles
    if (sessionId) setMsg(`¡Pago completado! (session ${sessionId.slice(0, 8)}...)`);
  }, [sessionId]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Gracias por tu compra 🎉</h1>
      <p>{msg}</p>
      <Link href={`/${storeSlug}`} className="underline">Volver a la tienda</Link>
    </div>
  );
}
