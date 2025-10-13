// src/app/layout.tsx
import type { Metadata } from "next";
import RootNavbar from "@/components/nav/RootNavbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "mercado-multi",
  description: "Multi-tienda simple con Next/Supabase/Stripe",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <RootNavbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
