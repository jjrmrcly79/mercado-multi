// src/components/nav/StoreNavbar.tsx
"use client";

import { useCart } from "@/components/CartProvider";

export default function StoreNavbar() {
  const { count } = useCart(); // ✅ aquí sí estamos bajo CartProvider
  return (
    <header className="w-full border-b">
      <div className="max-w-5xl mx-auto flex items-center justify-between p-4">
        <a href="/" className="font-semibold">mercado-multi</a>
        <nav className="text-sm flex items-center gap-4">
          <a href="#" className="hover:underline">Tienda</a>
          <a href="#" className="hover:underline">Contacto</a>
          <a href="cart" className="inline-flex items-center gap-2 px-3 py-1.5 border rounded">
            <span>Carrito</span>
            <span className="text-xs bg-black text-white rounded px-2 py-0.5">{count}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
