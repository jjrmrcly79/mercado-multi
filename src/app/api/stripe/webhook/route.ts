import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

export async function POST(req: NextRequest) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing Stripe env" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;

    const storeSlug = String(session.metadata?.storeSlug ?? "");
    const storeId = String(session.metadata?.storeId ?? "");
    if (!storeSlug || !storeId) {
      return NextResponse.json({ error: "Missing store metadata" }, { status: 400 });
    }

    // Traer line items de la sesión (para qty y precios)
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
      limit: 100,
    });

    // Calculamos en PESOS (tu schema usa numeric en unit_price)
    let subtotalPesos = 0;
    const itemsForInsert = lineItems.data.map(li => {
      const qty = li.quantity ?? 1;
      const unitCents = li.price?.unit_amount ?? Math.round((li.amount_subtotal ?? 0) / qty);
      const unitPesos = unitCents / 100;
      const subPesos = (li.amount_subtotal ?? unitCents * qty) / 100;

      subtotalPesos += subPesos;

      let product_id: string | null = null;
      if (li.price?.product && typeof li.price.product !== "string") {
        const prod = li.price.product as Stripe.Product;
        product_id = (prod.metadata?.productId as string) ?? null;
      }

      return {
        product_id,
        title: li.description ?? "Producto",
        unit_price: unitPesos,
        qty,
      };
    });

    const totalPesos =
      (session.amount_total ?? Math.round(subtotalPesos * 100)) / 100;

    // Folio: usa tu RPC y guarda en 'number'
    const { data: folio, error: folioErr } = await supabaseAdmin.rpc(
      "next_order_number",
      { p_store: storeId, p_slug: storeSlug }
    );
    if (folioErr || !folio) {
      throw folioErr ?? new Error("No order number");
    }

    // Insertar orden (usa columnas existentes; SIN checkout_session_id por ahora)
    const { data: order, error: ordErr } = await supabaseAdmin
      .from("orders")
      .insert({
        store_id: storeId,
        number: folio as string,
        email: session.customer_details?.email ?? session.customer_email ?? null,
        subtotal: subtotalPesos,
        discount_total: 0,
        shipping_total: 0,
        tax_total: 0,
        total: totalPesos,
        status: "paid",
      })
      .select("id")
      .single();
    if (ordErr) throw ordErr;

    // Insertar items con tus nombres de columnas
    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(
      itemsForInsert.map(i => ({
        order_id: order.id,
        product_id: i.product_id,
        title: i.title,
        unit_price: i.unit_price,
        qty: i.qty,
      }))
    );
    if (itemsErr) throw itemsErr;

    console.log("Order created:", { orderId: order.id, number: folio, sessionId: session.id });
    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("stripe webhook error", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
