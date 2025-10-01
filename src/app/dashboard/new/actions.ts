"use server";

import { createServerClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { createClient as createSb } from "@supabase/supabase-js";

// helper para garantizar string desde FormData
const s = (v: FormDataEntryValue | null) => (v == null ? "" : String(v));

// UUID sin importar "crypto" (evita líos de tipos en TS)
const randomUUID = () => crypto.randomUUID();

export type CreateStoreResult =
  | {
      ok: true;
      storeId: string;
      slug: string;
      logoUrl: string | null;
      brand: {
        name: string;
        brandDescription: string;
        brandAudience: string;
        brandTone: string;
      };
    }
  | { ok: false; error: string };

/**
 * Sube logo (si existe), crea la tienda y devuelve {storeId, slug, logoUrl}
 */
export async function createStoreWithLogo(formData: FormData): Promise<CreateStoreResult> {
  const supabase = await createServerClient();

  const name = s(formData.get("name")).trim();
  const slug = s(formData.get("slug")).trim().toLowerCase();
  const logoFile = formData.get("logo") as File | null;

  const brandDescription = s(formData.get("brand_description"));
  const brandAudience = s(formData.get("brand_audience"));
  const brandTone = s(formData.get("brand_tone"));
  const currency = s(formData.get("currency")).toUpperCase();
  const supportEmail = s(formData.get("support_email"));
  const supportPhone = s(formData.get("support_phone"));
  const accessToken = s(formData.get("access_token")); // ← NEW

  if (!name || !slug) return { ok: false, error: "Nombre y slug son obligatorios." };

  // 1) intentar leer usuario vía cookies (SSR)
  let { data: { user } } = await supabase.auth.getUser();

  // 2) ⛑️ Fallback con JWT si el SSR no ve la sesión
  let sb = supabase;
  if (!user && accessToken) {
    sb = createSb(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const { data: u2 } = await sb.auth.getUser();
    user = u2.user ?? null;
  }

  if (!user) return { ok: false, error: "Necesitas sesión para crear una tienda." };

  // 3) subir logo (opcional) usando el cliente autenticado (sb)
  let logoUrl: string | null = null;
  if (logoFile && logoFile.size > 0) {
    const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.id}/${slug}/${randomUUID()}.${ext}`;
    const arrayBuf = await logoFile.arrayBuffer();
    const buff = Buffer.from(arrayBuf);

    const { error: upErr } = await sb.storage
      .from("store-logos")
      .upload(path, buff, { contentType: logoFile.type || "image/png", upsert: false });

    if (upErr) {
      console.error("Logo upload error:", upErr.message);
    } else {
      const { data: pub } = sb.storage.from("store-logos").getPublicUrl(path);
      logoUrl = pub?.publicUrl ?? null;
    }
  }

  // 4) insert de la tienda con el mismo cliente autenticado (sb)
  const insertPayload: Record<string, any> = {
    owner_id: user.id,
    name,
    slug,
  };
  if (logoUrl) insertPayload.logo_url = logoUrl;
  if (currency) insertPayload.currency = currency;
  if (brandDescription) insertPayload.brand_description = brandDescription;
  if (brandAudience) insertPayload.brand_audience = brandAudience;
  if (brandTone) insertPayload.brand_tone = brandTone;
  if (supportEmail) insertPayload.support_email = supportEmail;
  if (supportPhone) insertPayload.support_phone = supportPhone;

  const { data: storeIns, error: insErr } = await sb
    .from("stores")
    .insert(insertPayload)
    .select("id, slug, logo_url")
    .single();

  if (insErr) return { ok: false, error: `No pude crear la tienda: ${insErr.message}` };

  return {
    ok: true,
    storeId: String(storeIns.id),
    slug: String(storeIns.slug),
    logoUrl: (storeIns.logo_url as string) ?? logoUrl,
    brand: { name, brandDescription, brandAudience, brandTone },
  };
}


type BrandParams = {
  storeId: string;
  name: string;
  brandDescription?: string;
  brandAudience?: string;
  brandTone?: string;
  logoUrl?: string | null;
};

export async function generateBrandAndPalette(params: BrandParams) {
  const supabase = await createServerClient();

  const storeId = params.storeId;
  const name = params.name;
  const brandDescription = params.brandDescription ?? "";
  const brandAudience = params.brandAudience ?? "";
  const brandTone = params.brandTone ?? "";
  const logoUrl = params.logoUrl ?? null;

  // OPENAI_API_KEY siempre string
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
  if (!OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY no configurada; usando fallback.");
  }
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const prompt = `
Eres estratega de marca e identidad visual.
Datos:
- Nombre: ${name}
- Descripción: ${brandDescription}
- Público objetivo: ${brandAudience}
- Tono de voz: ${brandTone}
- Logo: ${logoUrl ?? "sin logo"}

Devuelve JSON con claves exactamente:
{
  "mission":"...",
  "vision":"...",
  "values":["v1","v2","v3","v4","v5"],
  "palette":{"colors":["#112233","#445566","#778899","#AABBCC","#DDEEFF"],"primary":"#112233","secondary":"#778899"}
}
`;

  let mission = "";
  let vision = "";
  let values: string[] = [];
  let palette = { colors: [] as string[], primary: "", secondary: "" };

  try {
    if (OPENAI_API_KEY) {
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });
      const text = res.choices?.[0]?.message?.content?.toString().trim() || "{}";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      const json = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : {};

      mission = String(json.mission ?? "");
      vision = String(json.vision ?? "");
      values = Array.isArray(json.values) ? json.values.map(String) : [];
      if (json.palette?.colors && Array.isArray(json.palette.colors)) {
        palette.colors = json.palette.colors.map(String).slice(0, 5);
        palette.primary = String(json.palette.primary ?? palette.colors[0] ?? "");
        palette.secondary = String(json.palette.secondary ?? palette.colors[1] ?? "");
      }
    }
  } catch (e: any) {
    console.error("OpenAI error:", e?.message || e);
  }

  // fallbacks para asegurar strings
  if (!mission) mission = `Hacer crecer ${name} con calidad y cercanía.`;
  if (!vision)
    vision =
      "Ser referente de su categoría en 2–3 años, con foco en satisfacción del cliente y sustentabilidad.";
  if (values.length === 0)
    values = ["Calidad", "Confianza", "Innovación", "Cercanía", "Responsabilidad"];
  if (palette.colors.length === 0) {
    palette = {
      colors: ["#111827", "#1F2937", "#3B82F6", "#10B981", "#F59E0B"],
      primary: "#3B82F6",
      secondary: "#10B981",
    };
  }

  // update best-effort
  const updatePayload: Record<string, any> = {
    mission,
    vision,
    values,
    palette,
    primary_color: palette.primary,
    secondary_color: palette.secondary,
  };

  try {
    const { error: upErr } = await supabase.from("stores").update(updatePayload).eq("id", storeId);
    if (upErr) {
      console.warn("Update completo falló, reintentando mínimo:", upErr.message);
      await supabase
        .from("stores")
        .update({ mission, vision, values })
        .eq("id", storeId);
    }
  } catch (e) {
    console.error("Update stores failed:", e);
  }

  return { ok: true, mission, vision, values, palette };
}

