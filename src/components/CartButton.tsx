"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";

export default function CartButton() {
  const pathname = usePathname();
  
  // ✅ CORRECCIÓN: El hook se llama incondicionalmente en el nivel superior.
  const cartContext = useCart();

  // Extraer storeSlug si estás en /{slug} o /{slug}/cart
  const slugMatch = pathname?.split("/").filter(Boolean)[0] || "";
  
  // Determinar el contenido del botón de forma segura.
  // Si cartContext no existe (porque no hay Provider), muestra 'Cart' por defecto.
  const buttonContent = cartContext ? (
    <span>Cart ({cartContext.count})</span>
  ) : (
    <span>Cart</span>
  );

  return (
    <Link 
      href={`/${slugMatch}/cart`} 
      className="rounded bg-black px-3 py-2 text-white"
    >
      {buttonContent}
    </Link>
  );
}