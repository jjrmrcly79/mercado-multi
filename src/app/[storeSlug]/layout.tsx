"use client";

import { usePathname } from "next/navigation";
import CartProvider from "@/components/CartProvider";

export default function StoreSegmentLayout({ children }: { children: React.ReactNode }) {
  // Derivar el slug de la URL en cliente (evita el Promise de params)
  const pathname = usePathname();
  const storeSlug = pathname.split("/").filter(Boolean)[0] || "";

  return (
    <CartProvider storeSlug={storeSlug}>
      {children}
    </CartProvider>
  );
}
