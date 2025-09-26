import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const sig = req.headers.get("stripe-signature");
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !sig || !whSecret) {
      return NextResponse.json({ error: "Missing Stripe env" }, { status: 500 });
    }

    const raw = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, whSecret);
    } catch (err: any) {
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Traer line items (para qtys y unit amounts)
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ['data.price.product'] });

      // Rescatar storeId/slug del metadata
      const storeSlug = (session.metadata?.storeSlug || "").toString();
      const storeId = (session.metadata?.storeId || "").toString();
      const email = session.customer_details?.email || session.customer_email || null;

      // Totales a partir de line items
      let subtotal = 0;
      const toInsertItems: { product_id: string | null; title: string; unit_price: number; qty: number }[] = [];

      for (const li of lineItems.data) {
        const unit = (li.amount_subtotal ?? 0) / (li.quantity || 1) / 100;
        const qty = li.quantity || 1;
        subtotal += (li.amount_subtotal ?? 0) / 100;

        const productId = (li.price?.product as any)?.metadata?.productId || null;
        const title = li.description || "Producto";
        toInsertItems.push({
          product_id: productId,
          title,
          unit_price: unit,
          qty,
        });
      }

      const total = subtotal; // por ahora sin impuestos/envío/desc.
      // Generar número de orden
      const { data: numberRow, error: eNum } = await supabaseAdmin
        .rpc("next_order_number", { p_store: storeId, p_slug: storeSlug });
      if (eNum || !numberRow) throw eNum || new Error("No order number");

      // Insertar orden
      const { data: order, error: eOrd } = await supabaseAdmin
        .from("orders")
        .insert({
          store_id: storeId,
          number: numberRow as unknown as string,
          email,
          subtotal,
          discount_total: 0,
          shipping_total: 0,
          tax_total: 0,
          total,
          status: "paid",
          stripe_session_id: session.id,
        })
        .select("id")
        .single();
      if (eOrd) throw eOrd;

      // Insertar items
      const { error: eItems } = await supabaseAdmin.from("order_items").insert(
        toInsertItems.map(i => ({
          order_id: order.id,
          product_id: i.product_id,
          title: i.title,
          unit_price: i.unit_price,
          qty: i.qty,
        }))
      );
      if (eItems) throw eItems;

      // (Opcional) decrementar stock por product_id si lo deseas ahora
      // ...

      return NextResponse.json({ received: true });
    }

    // Ignora otros eventos por ahora
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("stripe webhook error", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic"; // para asegurar body raw en edge/dev
