// src/lib/supabase/server.ts
import { createServerClient as createSupabaseClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Tipo que contempla que en algunos contextos existan set/delete y en otros no
type MaybeMutableCookies = {
  get(name: string): { value: string } | undefined;
  set?: (init: { name: string; value: string } & CookieOptions) => void;
  delete?: (name: string) => void;
};

export async function createServerClient() {
  // En tu Next, cookies() retorna una Promise, así que await
  const cookieStore = (await cookies()) as MaybeMutableCookies;

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // En RSC no hay set(); en Actions/Routes sí.
            cookieStore.set?.({ name, value, ...options });
          } catch {
            /* no-op */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            if (typeof cookieStore.delete === 'function') {
              cookieStore.delete(name);
            } else {
              // Fallback: expirar la cookie si no existe delete()
              cookieStore.set?.({ name, value: '', ...options, maxAge: 0 });
            }
          } catch {
            /* no-op */
          }
        },
      },
    }
  );
}

// Alias para compatibilidad con imports existentes
export const getServerSupabase = createServerClient;
