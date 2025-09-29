import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
// Usando 'headers' para leer la firma de forma segura en App Router
import { headers } from "next/headers"; 
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

export async function POST(req: NextRequest) {
  console.log("✅ Webhook endpoint hit!"); // Log #1

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
    console.log(`✅ Signature verified. Event ID: ${event.id}`); // Log #2
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Solo nos interesa el evento que confirma el pago
  if (event.type !== "checkout.session.completed") {
    console.log(`- Ignoring event type: ${event.type}`);
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    console.log("🛒 Event: checkout.session.completed detected."); // Log #3
    const session = event.data.object as Stripe.Checkout.Session;

    const storeSlug = String(session.metadata?.storeSlug ?? "");
    const storeId = String(session.metadata?.storeId ?? "");

    if (!storeSlug || !storeId) {
      console.error("❌ Missing store metadata in session:", session.metadata);
      return NextResponse.json({ error: "Missing store metadata" }, { status: 400 });
    }
    console.log("📦 Metadata received:", { storeSlug, storeId }); // Log #4

    // Traer line items de la sesión
    console.log(`⏳ Fetching line items for session: ${session.id}`); // Log #5
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
      limit: 100,
    });
    console.log(`✅ Line items fetched. Count: ${lineItems.data.length}`); // Log #6

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
    
    // Llamar al RPC para el folio
    const rpcParams = { p_store: storeId, p_slug: storeSlug };
    console.log("⏳ Calling RPC 'next_order_number' with params:", rpcParams); // Log #7
    const { data: folio, error: folioErr } = await supabaseAdmin.rpc("next_order_number", rpcParams);

    if (folioErr) throw folioErr;
    if (!folio) throw new Error("RPC next_order_number returned null or empty.");
    console.log(`🧾 Order number generated: ${folio}`); // Log #8

    // Preparar datos para la orden
    const orderPayload = {
      store_id: storeId,
      number: folio as string,
      email: session.customer_details?.email ?? session.customer_email ?? null,
      subtotal: subtotalPesos,
      total: totalPesos,
      status: "paid",
      // Asegúrate que tu tabla tiene estos defaults o quítalos si no existen
      discount_total: 0,
      shipping_total: 0,
      tax_total: 0,
    };
    console.log("✍️ Inserting into 'orders' table:", orderPayload); // Log #9

    const { data: order, error: ordErr } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (ordErr) throw ordErr;
    console.log(`✅ Order created successfully with ID: ${order.id}`); // Log #10

    // Preparar datos para los items de la orden
    const itemsPayload = itemsForInsert.map(i => ({
      order_id: order.id,
      product_id: i.product_id,
      title: i.title,
      unit_price: i.unit_price,
      qty: i.qty,
    }));
    console.log("✍️ Inserting into 'order_items':", itemsPayload); // Log #11

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsPayload);
    if (itemsErr) throw itemsErr;

    console.log("✅ Order items inserted successfully."); // Log #12
    console.log("🎉 SUCCESS! Order fully processed:", { orderId: order.id, number: folio });
    
    return NextResponse.json({ received: true });

  } catch (e: any) {
    // Este log es el más importante si algo falla dentro del try
    console.error("--- ❌ STRIPE WEBHOOK PROCESSING ERROR ---");
    console.error(e);
    console.error("-----------------------------------------");
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}