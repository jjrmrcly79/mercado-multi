// src/app/api/checkout/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) console.warn("Falta STRIPE_SECRET_KEY en .env.local");

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

type ReqItem = { id: string; qty: number; variantId?: string | null }; // 👈 ahora soporta variantId
type ReqBody = { storeSlug: string; items: ReqItem[] };

export async function POST(req: NextRequest) {
  try {
    if (!stripe) return NextResponse.json({ error: "Falta STRIPE_SECRET_KEY" }, { status: 500 });

    const { storeSlug, items } = (await req.json()) as ReqBody;
    if (!storeSlug || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    // 1) storeId via RPC
    const { data: storeId, error: eSlug } = await supabaseAdmin.rpc("store_id_by_slug", { p_slug: storeSlug });
    if (eSlug || !storeId) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    // 2) Separamos ítems con variante vs sin variante
    const withVar   = items.filter(i => i.variantId);
    const withoutVar= items.filter(i => !i.variantId);

    // 3) Traer precios/títulos desde DB
    // 3a) variantes (join para obtener título del producto)
    let variantsRows: { id: string; product_id: string; price: number; title: string }[] = [];
    if (withVar.length) {
      const variantIds = withVar.map(i => i.variantId as string);
      const { data, error } = await supabaseAdmin
        .from("variants")
        .select("id, product_id, price, products!inner(id, title, store_id)")
        .in("id", variantIds);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      variantsRows = (data ?? []).map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        price: Number(r.price),
        title: r.products?.title ?? "Producto",
      }));
    }

    // 3b) productos (solo para los que no tienen variante)
    let productRows: { id: string; price: number; title: string }[] = [];
    if (withoutVar.length) {
      const productIds = withoutVar.map(i => i.id);
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("id, title, price, store_id")
        .in("id", productIds)
        .eq("store_id", storeId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      productRows = (data ?? []).map((r: any) => ({
        id: r.id,
        price: Number(r.price),
        title: r.title ?? "Producto",
      }));
    }

    // 4) Construir line_items
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // 4a) variantes
    for (const it of withVar) {
      const row = variantsRows.find(v => v.id === it.variantId);
      if (!row || it.qty <= 0) continue;
      line_items.push({
        quantity: it.qty,
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(row.price * 100),
          product_data: {
            name: `${row.title}`,
            metadata: { productId: row.product_id, variantId: row.id }, // 👈 mandamos ambos
          },
        },
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 99 },
      });
    }

    // 4b) productos sin variante
    for (const it of withoutVar) {
      const row = productRows.find(p => p.id === it.id);
      if (!row || it.qty <= 0) continue;
      line_items.push({
        quantity: it.qty,
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(row.price * 100),
          product_data: {
            name: row.title,
            metadata: { productId: row.id }, // 👈 sólo productId
          },
        },
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 99 },
      });
    }

    if (line_items.length === 0) {
      return NextResponse.json({ error: "No valid items" }, { status: 400 });
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const success_url = `${site}/${storeSlug}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url  = `${site}/${storeSlug}/cart`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url,
      cancel_url,
      customer_creation: "always",
      allow_promotion_codes: true,
      metadata: { storeSlug, storeId: String(storeId) },
      // shipping_address_collection: { allowed_countries: ["MX"] },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("checkout session error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
