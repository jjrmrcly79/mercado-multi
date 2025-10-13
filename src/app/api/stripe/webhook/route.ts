// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(STRIPE_SECRET_KEY);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing Stripe env" }, { status: 500 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    // Idempotencia: si ya procesamos esta sesión, salimos
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("checkout_session_id", sessionId)
      .maybeSingle();
    if (existing) return NextResponse.json({ received: true, duplicate: true });

    const storeSlug = String(session.metadata?.storeSlug ?? "");
    const storeId   = String(session.metadata?.storeId ?? "");
    if (!storeSlug || !storeId) {
      return NextResponse.json({ error: "Missing store metadata" }, { status: 400 });
    }

    // Obtenemos line items (con producto expandido para leer productId)
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      expand: ["data.price.product"],
      limit: 100,
    });

    // Stripe devuelve centavos: convertimos a pesos (numeric)
    let subtotalCents = 0;
    const itemsPayload = lineItems.data.map((li) => {
      const qty = li.quantity ?? 1;
      const unitAmountCents = li.price?.unit_amount ?? 0;
      const amountSubtotalCents = li.amount_subtotal ?? unitAmountCents * qty;

      subtotalCents += amountSubtotalCents;

      let product_id: string | null = null;
      let variant_id: string | null = null;
      if (li.price?.product && typeof li.price.product !== "string") {
        const prod = li.price.product as Stripe.Product;
        product_id = (prod.metadata?.productId as string) ?? null;
        variant_id = (prod.metadata?.variantId as string) ?? null; 
      }

      return {
        product_id,
        variant_id,
        title: li.description || "Producto",
        unit_amount_pesos: (unitAmountCents ?? 0) / 100,            // numeric (pesos)
        quantity: qty,
        amount_subtotal_pesos: (amountSubtotalCents ?? 0) / 100,    // numeric (pesos)
        amount_total_pesos: (li.amount_total ?? amountSubtotalCents) / 100, // numeric
      };
    });

    const totalPesos =
      (session.amount_total != null ? session.amount_total : subtotalCents) / 100;

    const email    = session.customer_details?.email ?? session.customer_email ?? null;
    const currency = (session.currency ?? "mxn").toUpperCase();

    // Folio: usamos tu RPC existente; devuelve el siguiente número
    const { data: folio, error: eNum } = await supabaseAdmin.rpc("next_order_number", {
      p_store: storeId,
      p_slug: storeSlug,
    });
    if (eNum || !folio) throw eNum ?? new Error("No order number");

    // Insertar orden (CAMPO FOLIO = number) y montos en pesos (numeric)
    const { data: order, error: eOrd } = await supabaseAdmin
      .from("orders")
      .insert({
        store_id: storeId,
        number: String(folio),      // <-- tu columna se llama 'number'
        email,
        currency,
        subtotal: subtotalCents / 100,
        discount_total: 0,
        shipping_total: 0,
        tax_total: 0,
        total: totalPesos,
        status: "paid",
        checkout_session_id: sessionId,
        // shipping_address: session.customer_details?.address ?? null, // si decides guardarla
      })
      .select("id")
      .single();
    if (eOrd) throw eOrd;

    // Insertar items (pesos)
    // 9) Insertar items de la orden
// 9) Insertar items de la orden (ajustado a tu esquema)
const { error: eItems } = await supabaseAdmin.from("order_items").insert(
  itemsPayload.map((i) => ({
    order_id: order.id,
    store_id: storeId,
    product_id: i.product_id,
    variant_id: i.variant_id,          // 👈 guardar variante si existe
    title: i.title,
    unit_price: i.unit_amount_pesos,   // tu esquema pide unit_price
    qty: i.quantity,                   // tu esquema usa qty (NOT NULL)
    amount_subtotal: i.amount_subtotal_pesos,
    amount_total: i.amount_total_pesos,
  }))
);
if (eItems) throw eItems;



// Descuento de stock: variante primero, si no hay variante, (opcional) producto
for (const i of itemsPayload) {
  if (i.variant_id && i.quantity > 0) {
    await supabaseAdmin.rpc("decrement_variant_stock", {
      p_variant: i.variant_id,
      p_qty: i.quantity,
    });
  } else if (i.product_id && i.quantity > 0) {
    // Si quieres también manejar stock por producto cuando no hay variante:
    // await supabaseAdmin.rpc("decrement_stock", { p_product: i.product_id, p_qty: i.quantity });
  }
}


    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("stripe webhook error", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
