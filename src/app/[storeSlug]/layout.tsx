// src/app/[storeSlug]/layout.tsx
import StoreNavbar from "@/components/nav/StoreNavbar";
import { CartProvider } from "@/components/CartProvider";

// 👇 En Next 15, params es Promise en componentes de servidor.
//    Hacemos el layout async y hacemos await de params.
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params; // ✅

  return (
    <CartProvider storeSlug={storeSlug}>
      <StoreNavbar />
      <main>{children}</main>
    </CartProvider>
  );
}
