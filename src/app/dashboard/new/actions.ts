"use server";

import { createServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import OpenAI from "openai";

/**
 * Sube logo (si existe), crea la tienda y devuelve {storeId, slug, logoUrl}
 * Campos mínimos requeridos: name, slug
 * Opcionales: brandDescription, brandAudience, brandTone, currency, supportEmail, supportPhone
 */
export async function createStoreWithLogo(formData: FormData) {
  const supabase = await createServerClient();

  const name = (formData.get("name") || "").toString().trim();
  const slug = (formData.get("slug") || "").toString().trim().toLowerCase();
  const logoFile = formData.get("logo") as File | null;

  const brandDescription = (formData.get("brand_description") || "").toString();
  const brandAudience = (formData.get("brand_audience") || "").toString();
  const brandTone = (formData.get("brand_tone") || "").toString();
  const currency = (formData.get("currency") || "").toString().toUpperCase();
  const supportEmail = (formData.get("support_email") || "").toString();
  const supportPhone = (formData.get("support_phone") || "").toString();

  if (!name || !slug) {
    return { ok: false, error: "Nombre y slug son obligatorios." };
  }

  // 1) usuario actual
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "Necesitas sesión para crear una tienda." };
  }

  // 2) subir logo si existe
  let logoUrl: string | null = null;
  if (logoFile && logoFile.size > 0) {
    const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.id}/${slug}/${randomUUID()}.${ext}`;

    // convertir File (web) a Buffer
    const arrayBuf = await logoFile.arrayBuffer();
    const buff = Buffer.from(arrayBuf);

    const { error: upErr } = await supabase.storage
      .from("store-logos")
      .upload(path, buff, {
        contentType: logoFile.type || "image/png",
        upsert: false,
      });

    if (upErr) {
      // no rompemos la creación — solo reportamos
      console.error("Logo upload error:", upErr.message);
    } else {
      const { data: pub } = supabase.storage
        .from("store-logos")
        .getPublicUrl(path);
      logoUrl = pub?.publicUrl ?? null;
    }
  }

  // 3) crear tienda (mínimos)
  const insertPayload: Record<string, any> = {
    owner_id: user.id,
    name,
    slug,
  };
  if (logoUrl) insertPayload.logo_url = logoUrl;
  if (currency) insertPayload.currency = currency;

  // Campos opcionales — si no existen en tu tabla, el backend no fallará en el insert (se ignoran)
  if (brandDescription) insertPayload.brand_description = brandDescription;
  if (brandAudience) insertPayload.brand_audience = brandAudience;
  if (brandTone) insertPayload.brand_tone = brandTone;
  if (supportEmail) insertPayload.support_email = supportEmail;
  if (supportPhone) insertPayload.support_phone = supportPhone;

  const { data: storeIns, error: insErr } = await supabase
    .from("stores")
    .insert(insertPayload)
    .select("id, slug, logo_url")
    .single();

  if (insErr) {
    return { ok: false, error: `No pude crear la tienda: ${insErr.message}` };
  }

  return {
    ok: true,
    storeId: storeIns.id as string,
    slug: storeIns.slug as string,
    logoUrl: (storeIns.logo_url as string) || logoUrl,
    brand: { name, brandDescription, brandAudience, brandTone },
  };
}

/**
 * Genera misión/visión/valores y paleta (5 hex) con OpenAI y actualiza la tienda.
 * Si tu tabla no tiene esas columnas, la función atrapa el error y prosigue sin romper.
 */
export async function generateBrandAndPalette(params: {
  storeId: string;
  name: string;
  brandDescription?: string;
  brandAudience?: string;
  brandTone?: string;
  // si tienes logoUrl y quieres intentar inferir color base textual:
  logoUrl?: string | null;
}) {
  const supabase = await createServerClient();
  const {
    storeId,
    name,
    brandDescription = "",
    brandAudience = "",
    brandTone = "",
    logoUrl = null,
  } = params;

  // 1) preparar prompt
  const prompt = `
Eres estratega de marca y experto en identidad visual.
Con estos datos:
- Nombre: ${name}
- Descripción: ${brandDescription}
- Público objetivo: ${brandAudience}
- Tono de voz: ${brandTone}
- Logo (opcional, describe dominante si procede): ${logoUrl ?? "sin logo"}

Devuélveme un JSON **válido** con EXACTAMENTE estas claves:
{
  "mission": "1 frase clara (<= 20 palabras).",
  "vision": "2–3 líneas, horizonte 2–3 años.",
  "values": ["valor1","valor2","valor3","valor4","valor5"],
  "palette": {
    "colors": ["#112233","#445566","#778899","#AABBCC","#DDEEFF"],
    "primary": "#112233",
    "secondary": "#778899"
  }
}
Asegúrate de que cada color es un HEX válido (#RRGGBB).
`;

  // 2) llamar OpenAI
  let mission = "";
  let vision = "";
  let values: string[] = [];
  let palette: { colors: string[]; primary: string; secondary: string } = {
    colors: [],
    primary: "",
    secondary: "",
  };

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const text =
      res.choices?.[0]?.message?.content?.toString().trim() || "{}";

    // intenta parsear JSON robustamente
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const json =
      jsonStart >= 0 && jsonEnd > jsonStart
        ? JSON.parse(text.slice(jsonStart, jsonEnd + 1))
        : {};

    mission = (json.mission || "").toString();
    vision = (json.vision || "").toString();
    values = Array.isArray(json.values) ? json.values.map(String) : [];
    if (json.palette?.colors && Array.isArray(json.palette.colors)) {
      palette = {
        colors: json.palette.colors.map(String).slice(0, 5),
        primary: String(json.palette.primary || json.palette.colors[0] || ""),
        secondary: String(
          json.palette.secondary || json.palette.colors[1] || ""
        ),
      };
    }
  } catch (e: any) {
    console.error("OpenAI error:", e?.message || e);
    // fallback mínimo para no romper flujo
    mission ||= `Hacer crecer ${name} con calidad y cercanía.`;
    vision ||=
      "Ser una marca referente en su categoría en 2–3 años, con foco en satisfacción del cliente y sustentabilidad.";
    values = values.length
      ? values
      : ["Calidad", "Confianza", "Innovación", "Cercanía", "Responsabilidad"];
    palette = palette.colors.length
      ? palette
      : {
          colors: ["#111827", "#1F2937", "#3B82F6", "#10B981", "#F59E0B"],
          primary: "#3B82F6",
          secondary: "#10B981",
        };
  }

  // 3) actualizar tienda (best-effort por columnas opcionales)
  // hacemos un solo update, y si falla por columna inexistente, lo degradamos
  let updatePayload: Record<string, any> = {
    mission,
    vision,
    values,
    palette,
    primary_color: palette.primary,
    secondary_color: palette.secondary,
  };

  try {
    const { error: upErr } = await supabase
      .from("stores")
      .update(updatePayload)
      .eq("id", storeId);
    if (upErr) {
      // degradación: reintentar solo con campos que probablemente existan
      console.warn("Update full payload failed, retrying minimal:", upErr.message);
      const minimal: Record<string, any> = {};
      if ("mission" in updatePayload) minimal.mission = mission;
      if ("vision" in updatePayload) minimal.vision = vision;
      if ("values" in updatePayload) minimal.values = values;

      await supabase.from("stores").update(minimal).eq("id", storeId);
    }
  } catch (e) {
    console.error("Update stores failed:", e);
  }

  return {
    ok: true,
    mission,
    vision,
    values,
    palette,
  };
}
