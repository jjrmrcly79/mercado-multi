export type CartItem = {
  id: string;           // product id
  title: string;
  price: number;
  qty: number;
  image?: string | null;
};

const key = (storeSlug: string) => `cart:${storeSlug}`;

export function loadCart(storeSlug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(storeSlug));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCart(storeSlug: string, items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(storeSlug), JSON.stringify(items));
}

export function addItem(storeSlug: string, item: CartItem) {
  const items = loadCart(storeSlug);
  const i = items.findIndex(x => x.id === item.id);
  if (i >= 0) { items[i].qty += item.qty; }
  else { items.push(item); }
  saveCart(storeSlug, items);
  return items;
}

export function removeItem(storeSlug: string, id: string) {
  const items = loadCart(storeSlug).filter(x => x.id !== id);
  saveCart(storeSlug, items);
  return items;
}

export function setQty(storeSlug: string, id: string, qty: number) {
  const items = loadCart(storeSlug).map(x => x.id === id ? { ...x, qty } : x).filter(x => x.qty > 0);
  saveCart(storeSlug, items);
  return items;
}

export function totals(items: CartItem[]) {
  const subtotal = items.reduce((s, x) => s + x.price * x.qty, 0);
  return { subtotal, total: subtotal };
}
