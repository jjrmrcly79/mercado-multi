"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";

export default function CartButton() {
  const pathname = usePathname();
  // extraer storeSlug si estás en /{slug} o /{slug}/cart
  const slugMatch = pathname?.split("/").filter(Boolean)[0] || "";
  let btn = <span>Cart</span>;

  try {
    // si existe provider, mostramos conteo
    const { count } = useCart() as any;
    btn = <span>Cart ({count})</span>;
  } catch { /* no hay provider en esta ruta */ }

  return (
    <Link href={`/${slugMatch ? slugMatch : ""}/cart`} className="rounded bg-black px-3 py-2 text-white">
      {btn}
    </Link>
  );
}
