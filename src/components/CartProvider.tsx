"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  addItem as add,
  loadCart,
  removeItem as rem,
  setQty as setq,
  totals,
  CartItem,
} from "@/lib/cart";

type Ctx = {
  items: CartItem[];
  count: number;
  addItem: (it: CartItem) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  subtotal: number;
  total: number;
  storeSlug: string;
};

const CartCtx = createContext<Ctx | null>(null);

export function CartProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Cargar carrito desde LocalStorage al montar/cambiar de tienda
  useEffect(() => {
    setItems(loadCart(storeSlug));
  }, [storeSlug]);

  const api = useMemo<Ctx>(() => {
    const addItem = (it: CartItem) => setItems(add(storeSlug, it));
    const removeItem = (id: string) => setItems(rem(storeSlug, id));
    const setQty = (id: string, qty: number) => setItems(setq(storeSlug, id, qty));
    const { subtotal, total } = totals(items);
    const count = items.reduce((s, x) => s + x.qty, 0);

    return {
      items,
      count,
      addItem,
      removeItem,
      setQty,
      subtotal,
      total,
      storeSlug,
    };
  }, [items, storeSlug]);

  return <CartCtx.Provider value={api}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used within <CartProvider/>");
  return ctx;
}

// ❌ NO default export: evita duplicidades e imports ambiguos
