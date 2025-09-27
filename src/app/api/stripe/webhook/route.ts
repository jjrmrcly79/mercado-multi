import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !whSecret) {
    return NextResponse.json({ error: "Missing Stripe env" }, { status: 500 });
  }

  let event: Stripe.Event;
  const raw = await req.text();

  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true }); // otros eventos los ignoramos por ahora
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;

    // Idempotencia rápida por sesión
    // Requiere una UNIQUE en DB: unique(checkout_session_id)
    // (ver SQL más abajo)
    const sessionId = session.id;

    const storeSlug = String(session.metadata?.storeSlug ?? "");
    const storeId = String(session.metadata?.storeId ?? "");
    if (!storeSlug || !storeId) {
      throw new Error("Missing store metadata");
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
      limit: 100,
    });

    // Trabajemos en CENTAVOS
    let subtotal_cents = 0;

    type ItemRow = {
      product_id: string | null;
      title: string;
      unit_amount_cents: number;
      qty: number;
      amount_subtotal_cents: number;
      amount_total_cents: number;
    };

    const toInsertItems: ItemRow[] = [];

    for (const li of lineItems.data) {
      const qty = li.quantity ?? 1;
      const amountSubtotalCents = li.amount_subtotal ?? (li.price?.unit_amount ?? 0) * qty;
      const amountTotalCents = li.amount_total ?? amountSubtotalCents;

      subtotal_cents += amountSubtotalCents;

      // productId desde metadata del product creado vía price_data
      let productId: string | null = null;
      const price = li.price as Stripe.Price | null;
      if (price && price.product && typeof price.product !== "string") {
        const prod = price.product as Stripe.Product;
        productId = (prod.metadata?.productId as string) ?? null;
      }

      const title = li.description || "Producto";
      const unitAmountCents = li.price?.unit_amount ?? Math.round(amountSubtotalCents / qty);

      toInsertItems.push({
        product_id: productId,
        title,
        unit_amount_cents: unitAmountCents,
        qty,
        amount_subtotal_cents: amountSubtotalCents,
        amount_total_cents: amountTotalCents,
      });
    }

    const total_cents = session.amount_total ?? subtotal_cents;
    const currency = (session.currency ?? "mxn").toUpperCase();
    const email =
      session.customer_details?.email ?? session.customer_email ?? null;

    // Folio
    const { data: folio, error: eNum } = await supabaseAdmin.rpc("next_order_number", {
      p_store: storeId,
      p_slug: storeSlug,
    });
    if (eNum || !folio) throw eNum || new Error("No order number");

    // Insert de orden
    const { data: order, error: eOrd } = await supabaseAdmin
      .from("orders")
      .insert({
        store_id: storeId,
        number: folio as string,          // 👈 usa el nombre correcto
        email,
        currency,
        subtotal: subtotal_cents,               // 👈 centavos
        discount_total: 0,
        shipping_total: 0,
        tax_total: 0,
        total: total_cents,                     // 👈 centavos
        status: "paid",
        checkout_session_id: sessionId,         // 👈 unique
      })
      .select("id")
      .single();
    if (eOrd) throw eOrd;

    // Insert items (ajusta nombres de columnas a tu esquema)
    const { error: eItems } = await supabaseAdmin.from("order_items").insert(
      toInsertItems.map(i => ({
        order_id: order.id,
        store_id: storeId,
        product_id: i.product_id,               // puede ser null si no hay match
        title: i.title,
        unit_amount: i.unit_amount_cents,       // 👈 centavos
        quantity: i.qty,
        amount_subtotal: i.amount_subtotal_cents,
        amount_total: i.amount_total_cents,
      }))
    );
    if (eItems) throw eItems;

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("stripe webhook error", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
