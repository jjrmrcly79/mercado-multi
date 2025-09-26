"use client";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart, LogIn } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        {/* Logo */}
        <Link href="/" className="font-extrabold text-xl tracking-tight">
          <span className="text-rose-600">CLASSY</span>SHOP
        </Link>

        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Input
              placeholder="Search for products..."
              className="h-10 pl-4 pr-10"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
              ⌘K
            </span>
          </div>
        </div>

        {/* Actions */}
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2">
            <LogIn className="h-4 w-4" /> Login
          </Button>
          <Button variant="ghost" size="sm" className="gap-2">
            <Heart className="h-4 w-4" /> Wishlist
          </Button>
          <Button variant="default" size="sm" className="gap-2">
            <ShoppingCart className="h-4 w-4" /> Cart (0)
          </Button>
        </nav>
      </div>
    </header>
  );
}
