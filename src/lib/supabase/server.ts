import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function getServerSupabase() {
  const cookieStore = await cookies(); // 👈 importante

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value ?? null;
        },
        set() {
          /* Next 15 maneja las cookies internamente en SSR; no necesitamos set/remove aquí */
        },
        remove() {},
      },
    }
  );
}
