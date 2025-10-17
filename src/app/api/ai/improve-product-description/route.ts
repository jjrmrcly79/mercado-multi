import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const {
      text,
      title,
      lang = "es",
      tone = "claro y persuasivo",
    }: {
      text: string;
      title?: string;
      lang?: string;
      tone?: string;
    } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Falta el texto original" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const name = (title ?? "").toLowerCase();

    // Detectamos categoría automáticamente
    let prompt: string;

    // 💎 Perfumes o fragancias
    if (name.includes("perfume") || name.includes("fragancia") || name.includes("eau") || name.includes("colonia")) {
      prompt = `
Eres un redactor experto en perfumería y estilo de vida.
Tu tarea es mejorar la siguiente descripción en ${lang}, con un tono ${tone}.
Utiliza lenguaje evocador, elegante y sensorial.

- Identifica el tipo de fragancia (floral, amaderado, cítrico, oriental, etc.) si se puede inferir.
- Describe la experiencia olfativa de forma poética pero precisa.
- Resalta las notas principales (de salida, corazón y fondo) si están presentes o son reconocibles.
- Incluye 2–3 viñetas opcionales con las emociones, estilo o momentos ideales para usarlo.
- Evita exagerar (“el mejor perfume del mundo”) y no inventes notas o efectos no mencionados.

Nombre del producto:
"""${title ?? "Perfume"}"""

Descripción original:
"""${text}"""
      `.trim();
    }

    // 🍄 Hongos o suplementos naturales
    else if (
      name.includes("melena de león") ||
      name.includes("cordyceps") ||
      name.includes("reishi") ||
      name.includes("chaga") ||
      name.includes("shiitake") ||
      name.includes("hongo") ||
      name.includes("suplemento")
    ) {
      prompt = `
Eres un redactor especializado en bienestar y hongos medicinales.
Tu tarea es mejorar la descripción del producto en ${lang}, con un tono ${tone}, informativo pero natural.

- Explica brevemente los beneficios conocidos de este hongo o suplemento (memoria, enfoque, energía, inmunidad, etc.), basándote en conocimiento general.
- Usa lenguaje accesible y auténtico, sin hacer afirmaciones médicas.
- Si el texto lo permite, incluye 2–3 viñetas con sus aportes o formas de consumo.
- Mantén un estilo cálido y confiable, sin tono de venta agresivo.

Nombre del producto:
"""${title ?? "Producto natural"}"""

Descripción original:
"""${text}"""
      `.trim();
    }

    // 🌿 Productos botánicos, cosméticos o naturales
    else if (
      name.includes("aceite") ||
      name.includes("jabón") ||
      name.includes("velas") ||
      name.includes("incienso") ||
      name.includes("aroma") ||
      name.includes("herbal") ||
      name.includes("esencia")
    ) {
      prompt = `
Eres un redactor de productos botánicos y de bienestar.
Reescribe la descripción en ${lang}, con un tono ${tone}, natural y relajante.

- Destaca los ingredientes principales y sus aromas.
- Explica la sensación o ambiente que evoca (calma, energía, frescura, conexión).
- Usa un lenguaje poético pero realista.
- Incluye 2 viñetas con los beneficios sensoriales o momentos ideales de uso.
- No prometas efectos médicos ni milagrosos.

Nombre del producto:
"""${title ?? "Producto botánico"}"""

Descripción original:
"""${text}"""
      `.trim();
    }

    // 🧩 Default: producto general (tecnología, hogar, etc.)
    else {
      prompt = `
Eres un copywriter experto en descripciones de productos.
Reescribe el siguiente texto en ${lang}, con un tono ${tone}.

- Usa un lenguaje claro, atractivo y profesional.
- Resalta las ventajas o usos más importantes del producto.
- Si aplica, incluye 2–3 viñetas con características o beneficios clave.
- Evita repeticiones, palabras vacías o afirmaciones falsas.

Nombre del producto:
"""${title ?? "Producto"}"""

Descripción original:
"""${text}"""
      `.trim();
    }

    // ✅ Llamada a OpenAI
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    const improved =
      resp.choices?.[0]?.message?.content?.trim() || text;

    return NextResponse.json({ improved });
  } catch (err: any) {
    console.error("AI Error:", err);
    return NextResponse.json(
      { error: err?.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}


