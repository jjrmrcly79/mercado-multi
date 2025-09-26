import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Opción simple: sin apiVersion para evitar tipos literales
  return new Stripe(key);
}

type ReqBody = {
  storeSlug: string;
  items: { id: string; qty: number }[];
};

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Falta STRIPE_SECRET_KEY en .env.local" },
        { status: 500 }
      );
    }

    const { storeSlug, items } = (await req.json()) as ReqBody;
    if (!storeSlug || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    // obtener storeId vía RPC pública
    const { data: storeId, error: eSlug } = await supabaseAdmin.rpc(
      "store_id_by_slug",
      { p_slug: storeSlug }
    );
    if (eSlug || !storeId) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // traer productos de DB (valida precios)
    const productIds = items.map((i) => i.id);
    const { data: rows, error: eProds } = await supabaseAdmin
      .from("products")
      .select("id, title, price")
      .in("id", productIds)
      .eq("store_id", storeId);

    if (eProds) {
      return NextResponse.json({ error: eProds.message }, { status: 500 });
    }
    if (!rows?.length) {
      return NextResponse.json({ error: "No products" }, { status: 400 });
    }

    const priceById = new Map(rows.map((r) => [r.id, Number(r.price)]));
        const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items
      .map(({ id, qty }) => {
        const unit = priceById.get(id);
        if (!unit || qty <= 0) return null;
        const title = rows.find(r => r.id === id)?.title || "Producto";
        return {
          quantity: qty,
          price_data: {
            currency: "mxn",
            product_data: {
              name: title,
              metadata: { productId: id },   // 👈 importante para el webhook
            },
            unit_amount: Math.round(unit * 100),
          },
        };
      })
      .filter(Boolean) as any[];

    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const success_url = `${site}/${storeSlug}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${site}/${storeSlug}/cart`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url,
      cancel_url,
      customer_creation: "always",           // crea/usa customer
      allow_promotion_codes: true,
      metadata: { storeSlug, storeId: String(storeId) },
      // optional: shipping_address_collection: { allowed_countries: ['MX','US'] },
    });


    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("checkout session error", e);
    // si por alguna razón Next lanzó una página HTML, devolvemos texto
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
