// src/app/api/checkout/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.warn("Falta STRIPE_SECRET_KEY en .env.local");
}

// Cliente único de Stripe (opcional: fija versión del API)
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY /*, { apiVersion: "2024-06-20" } */) : null;

type ReqBody = {
  storeSlug: string;
  items: { id: string; qty: number }[];
};

export async function POST(req: NextRequest) {
  try {
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

    // 1) Obtener storeId vía RPC pública
    const { data: storeId, error: eSlug } = await supabaseAdmin.rpc(
      "store_id_by_slug",
      { p_slug: storeSlug }
    );
    if (eSlug || !storeId) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // 2) Traer productos (validar precios del lado servidor)
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

    // 3) Construir line_items (en centavos)
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items
      .map(({ id, qty }) => {
        const unit = priceById.get(id);
        if (unit == null || qty <= 0) return null;
        const title = rows.find((r) => r.id === id)?.title || "Producto";
        return {
          quantity: qty,
          price_data: {
            currency: "mxn",
            unit_amount: Math.round(unit * 100), // centavos
            product_data: {
              name: title,
              metadata: { productId: id }, // útil para el webhook
            },
          },
          adjustable_quantity: { enabled: true, minimum: 1, maximum: 99 },
        };
      })
      .filter(Boolean) as Stripe.Checkout.SessionCreateParams.LineItem[];

    if (line_items.length === 0) {
      return NextResponse.json({ error: "No valid items" }, { status: 400 });
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const success_url = `${site}/${storeSlug}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${site}/${storeSlug}/cart`;

    // 4) Crear la Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // payment_method_types ya no es necesario; Stripe lo infiere
      line_items,
      success_url,
      cancel_url,
      customer_creation: "always",
      allow_promotion_codes: true,
      metadata: { storeSlug, storeId: String(storeId) },
      // Actívalo cuando quieras recolectar dirección:
      // shipping_address_collection: { allowed_countries: ["MX"] },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("checkout session error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
