// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");

  if (code) {
    const supabase = await getServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Seguridad básica: sólo permitimos rutas internas
  const next =
    nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";

  return NextResponse.redirect(new URL(next, request.url));
}
