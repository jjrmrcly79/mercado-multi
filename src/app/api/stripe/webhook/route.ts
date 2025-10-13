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
  // 0) Firma
  const sig = req.headers.get("stripe-signature");
  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing Stripe env" }, { status: 500 });
  }

  // 1) Construir evento con el body RAW
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // 2) Solo atendemos checkout.session.completed
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    // 3) Idempotencia por session.id
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("checkout_session_id", sessionId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // 4) Metadata esencial
    const storeSlug = String(session.metadata?.storeSlug ?? "");
    const storeId = String(session.metadata?.storeId ?? "");
    if (!storeSlug || !storeId) {
      return NextResponse.json({ error: "Missing store metadata" }, { status: 400 });
    }

    // 5) Line items (expand product para leer metadata)
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      expand: ["data.price.product"],
      limit: 100,
    });

    // 6) Calcular montos (Stripe en centavos → convertir a pesos)
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
        unit_amount_pesos: (unitAmountCents ?? 0) / 100, // numeric
        quantity: qty,
        amount_subtotal_pesos: (amountSubtotalCents ?? 0) / 100, // numeric
        amount_total_pesos: (li.amount_total ?? amountSubtotalCents) / 100, // numeric
      };
    });

    const totalPesos =
      (session.amount_total != null ? session.amount_total : subtotalCents) / 100;

    const email = session.customer_details?.email ?? session.customer_email ?? null;
    const currency = (session.currency ?? "mxn").toUpperCase();

    // 7) Folio (RPC existente)
    const { data: folio, error: eNum } = await supabaseAdmin.rpc("next_order_number", {
      p_store: storeId,
      p_slug: storeSlug,
    });
    if (eNum || !folio) throw eNum ?? new Error("No order number");

    // 8) Insertar orden (pesos)
    const { data: order, error: eOrd } = await supabaseAdmin
      .from("orders")
      .insert({
        store_id: storeId,
        number: String(folio),
        email,
        currency,
        subtotal: subtotalCents / 100,
        discount_total: 0,
        shipping_total: 0,
        tax_total: 0,
        total: totalPesos,
        status: "paid",
        checkout_session_id: sessionId,
        // shipping_address: session.customer_details?.address ?? null,
      })
      .select("id")
      .single();
    if (eOrd) throw eOrd;

    // 9) Insertar items (ajustado a tu esquema: unit_price + qty, y variant_id)
    const { error: eItems } = await supabaseAdmin.from("order_items").insert(
      itemsPayload.map((i) => ({
        order_id: order.id,
        store_id: storeId,
        product_id: i.product_id,
        variant_id: i.variant_id,
        title: i.title,
        unit_price: i.unit_amount_pesos, // NOT NULL en tu tabla
        qty: i.quantity, // NOT NULL en tu tabla
        amount_subtotal: i.amount_subtotal_pesos,
        amount_total: i.amount_total_pesos,
      }))
    );
    if (eItems) throw eItems;

    // 10) Descuento de stock (variante primero; opcional producto)
for (const i of itemsPayload) {
  if (i.variant_id && i.quantity > 0) {
    await supabaseAdmin.rpc("decrement_variant_stock", {
      p_variant: i.variant_id,
      p_qty: i.quantity,
    });
  } else if (i.product_id && i.quantity > 0) {
    // Descuenta stock por producto si decides manejar ambos niveles:
    // await supabaseAdmin.rpc("decrement_stock", { p_product: i.product_id, p_qty: i.quantity });
  }
}

return NextResponse.json({ received: true });
} catch (e: any) {
  console.error("stripe webhook error", e);
  return NextResponse.json(
    { error: e?.message || "Server error" },
    { status: 500 }
  );
}
}