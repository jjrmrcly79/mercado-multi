// src/app/[storeSlug]/layout.tsx
import StoreNavbar from "@/components/nav/StoreNavbar";
import { CartProvider } from "@/components/CartProvider";

export default function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { storeSlug: string };
}) {
  return (
    <CartProvider storeSlug={params.storeSlug}>
      <StoreNavbar />
      <main>{children}</main>
    </CartProvider>
  );
}
