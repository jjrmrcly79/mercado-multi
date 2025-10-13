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

export async function createStoreWithLogo(formData: FormData): Promise<CreateStoreResult> {
  console.log("--- Iniciando createStoreWithLogo (v5 - SECURITY DEFINER) ---");
  const supabase = await createServerClient();
  
  const name = s(formData.get("name")).trim();
  const slug = s(formData.get("slug")).trim().toLowerCase();
  const logoFile = formData.get("logo") as File | null;
  const brandDescription = s(formData.get("brand_description"));
  const brandAudience = s(formData.get("brand_audience"));
  const brandTone = s(formData.get("brand_tone"));
  const accessToken = s(formData.get("access_token"));

  let { data: { user } } = await supabase.auth.getUser();
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
  if (!user) {
    return { ok: false, error: "Necesitas sesión para crear una tienda." };
  }

  let logoUrl: string | null = null;
  if (logoFile && logoFile.size > 0) {
    const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.id}/${slug}/${randomUUID()}.${ext}`;
    const { error: upErr } = await sb.storage.from("store-logos").upload(path, logoFile);
    if (upErr) {
      console.error("Logo upload error:", upErr.message);
    } else {
      const { data: pub } = sb.storage.from("store-logos").getPublicUrl(path);
      logoUrl = pub?.publicUrl ?? null;
    }
  }

  console.log(`[DEBUG] Calling RPC 'create_store_and_add_owner' as user ${user.id}`);
  const { data: storeIns, error: insErr } = await sb
    .rpc('create_store_and_add_owner', {
      p_user_id: user.id,
      p_name: name,
      p_slug: slug,
      p_logo_url: logoUrl,
      p_brand_description: brandDescription,
      p_brand_audience: brandAudience,
      p_brand_tone: brandTone
    })
    .select()
    .single();

  if (insErr) {
    console.error("⛔ [ERROR DE SUPABASE AL RPC]:", JSON.stringify(insErr, null, 2));
    return { ok: false, error: `No pude crear la tienda: ${insErr.message}` };
  }

  console.log("✅ [SUCCESS] Tienda creada con RPC:", storeIns);

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

// ✅ CORRECCIÓN: Se define un tipo para la paleta de colores y el payload de actualización
type ColorPalette = {
  colors: string[];
  primary: string;
  secondary: string;
};

type StoreBrandPayload = {
  mission: string;
  vision: string;
  values: string[];
  palette: ColorPalette;
  primary_color: string;
  secondary_color: string;
};

export async function generateBrandAndPalette(params: BrandParams) {
  const supabase = await createServerClient();

  const storeId = params.storeId;
  const name = params.name;
  const brandDescription = params.brandDescription ?? "";
  const brandAudience = params.brandAudience ?? "";
  const brandTone = params.brandTone ?? "";
  const logoUrl = params.logoUrl ?? null;

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
  let palette: ColorPalette = { colors: [], primary: "", secondary: "" };

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
  } catch (e) {
    if (e instanceof Error) {
      console.error("OpenAI error:", e.message);
    } else {
      console.error("An unknown OpenAI error occurred", e);
    }
  }

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
  
  // ✅ CORRECCIÓN: Se usa el tipo específico 'StoreBrandPayload' en lugar de 'any'
  const updatePayload: StoreBrandPayload = {
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