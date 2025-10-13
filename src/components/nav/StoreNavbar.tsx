"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function StoreNavbar() {
  const { count, storeSlug } = useCart();

  return (
    <header className="w-full border-b">
      <div className="max-w-5xl mx-auto flex items-center justify-between p-4">
        <Link href="/" className="font-semibold">
          mercado-multi
        </Link>
        <nav className="text-sm flex items-center gap-4">
          <Link href={`/${storeSlug}`} className="hover:underline">
            Tienda
          </Link>
          <Link href="#" className="hover:underline">
            Contacto
          </Link>
          <Link
            href={`/${storeSlug}/cart`}
            className="inline-flex items-center gap-2 px-3 py-1.5 border rounded"
          >
            <span>Carrito</span>
            <span className="text-xs bg-black text-white rounded px-2 py-0.5">
              {count}
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
