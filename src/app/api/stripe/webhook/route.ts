import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
// ❌ Se elimina la siguiente línea porque no se usa:
// import { headers } from "next/headers"; 
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

export async function POST(req: NextRequest) {
  console.log("✅ Webhook endpoint hit!");

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Missing Stripe environment variables.");
    return NextResponse.json({ error: "Missing Stripe env" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("❌ Missing stripe-signature header.");
    return new NextResponse("Missing signature", { status: 400 });
  }
  
  const raw = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
    console.log(`✅ Signature verified. Event ID: ${event.id}`);
  } catch (err) {
    let errorMessage = "An unknown error occurred during webhook signature verification.";
    
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    
    console.error(`❌ Webhook signature verification failed:`, errorMessage);
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    console.log(`- Ignoring event type: ${event.type}`);
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    console.log("🛒 Event: checkout.session.completed detected.");
    const session = event.data.object as Stripe.Checkout.Session;

    const storeSlug = String(session.metadata?.storeSlug ?? "");
    const storeId = String(session.metadata?.storeId ?? "");

    if (!storeSlug || !storeId) {
      console.error("❌ Missing store metadata in session:", session.metadata);
      return NextResponse.json({ error: "Missing store metadata" }, { status: 400 });
    }
    console.log("📦 Metadata received:", { storeSlug, storeId });

    console.log(`⏳ Fetching line items for session: ${session.id}`);
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
      limit: 100,
    });
    console.log(`✅ Line items fetched. Count: ${lineItems.data.length}`);

    let subtotalPesos = 0;
    const itemsForInsert = lineItems.data.map(li => {
      const qty = li.quantity ?? 1;
      const unitCents = li.price?.unit_amount ?? 0;
      const unitPesos = unitCents / 100;
      subtotalPesos += (li.amount_subtotal ?? 0) / 100;

      let product_id: string | null = null;
      if (li.price?.product && typeof li.price.product !== "string") {
        const prod = li.price.product as Stripe.Product;
        product_id = prod.metadata?.productId ?? null;
      }
      return { product_id, title: li.description, unit_price: unitPesos, qty };
    });

    const totalPesos = (session.amount_total ?? 0) / 100;
    
    const rpcParams = { p_store: storeId, p_slug: storeSlug };
    console.log("⏳ Calling RPC 'next_order_number' with params:", rpcParams);
    const { data: folio, error: folioErr } = await supabaseAdmin.rpc("next_order_number", rpcParams);

    if (folioErr) throw folioErr;
    if (!folio) throw new Error("RPC next_order_number returned null or empty.");
    console.log(`🧾 Order number generated: ${folio}`);

    const orderPayload = {
      store_id: storeId,
      number: folio as string,
      email: session.customer_details?.email ?? session.customer_email ?? null,
      subtotal: subtotalPesos,
      total: totalPesos,
      status: "paid",
      discount_total: 0,
      shipping_total: 0,
      tax_total: 0,
    };
    console.log("✍️ Inserting into 'orders' table:", orderPayload);

    const { data: order, error: ordErr } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (ordErr) throw ordErr;
    console.log(`✅ Order created successfully with ID: ${order.id}`);

    const itemsPayload = itemsForInsert.map(i => ({
      order_id: order.id,
      product_id: i.product_id,
      title: i.title,
      unit_price: i.unit_price,
      qty: i.qty,
    }));
    console.log("✍️ Inserting into 'order_items':", itemsPayload);

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsPayload);
    if (itemsErr) throw itemsErr;

    console.log("✅ Order items inserted successfully.");
    console.log("🎉 SUCCESS! Order fully processed:", { orderId: order.id, number: folio });
    
    return NextResponse.json({ received: true });

  } catch (e) {
    console.error("--- ❌ STRIPE WEBHOOK PROCESSING ERROR ---");
    console.error("El objeto de error completo es:", e);
    console.error("-----------------------------------------");

    let errorMessage = "An unknown server error occurred.";
    if (e instanceof Error) {
      errorMessage = e.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}