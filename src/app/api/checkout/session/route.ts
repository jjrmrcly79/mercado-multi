import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

type ReqBody = {
  storeSlug: string;
  items: { id: string; qty: number }[]; // product.id y cantidad
};

export async function POST(req: NextRequest) {
  try {
    const { storeSlug, items } = (await req.json()) as ReqBody;
    if (!storeSlug || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    // 1) obtener store_id (usando la RPC pública que ya creamos)
    const { data: storeId, error: eSlug } = await supabaseAdmin
      .rpc("store_id_by_slug", { p_slug: storeSlug });
    if (eSlug || !storeId) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // 2) Traer productos con su precio real desde DB (seguro contra manipulación)
    const productIds = items.map(i => i.id);

    const { data: rows, error: eProds } = await supabaseAdmin
      .from("products")
      .select("id, title, price")
      .in("id", productIds)
      .eq("store_id", storeId);

    if (eProds) {
      return NextResponse.json({ error: eProds.message }, { status: 500 });
    }
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "No products" }, { status: 400 });
    }

    // indexar por id y mapear a line_items
    const priceById = new Map(rows.map(r => [r.id, Number(r.price)]));

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items
      .map(({ id, qty }) => {
        const unit = priceById.get(id);
        if (!unit || qty <= 0) return null;
        return {
          quantity: qty,
          price_data: {
            currency: "mxn",
            product_data: { name: rows.find(r => r.id === id)?.title || "Producto" },
            unit_amount: Math.round(unit * 100),
          },
        };
      })
      .filter(Boolean) as any[];

    if (line_items.length === 0) {
      return NextResponse.json({ error: "Empty cart" }, { status: 400 });
    }

    // 3) Crear Checkout Session
    const site = process.env.NEXT_PUBLIC_SITE_URL!;
    const success_url = `${site}/${storeSlug}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${site}/${storeSlug}/cart`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url,
      cancel_url,
      metadata: {
        storeSlug,
        storeId: String(storeId),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("checkout session error", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
