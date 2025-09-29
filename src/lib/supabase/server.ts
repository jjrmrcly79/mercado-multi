// src/lib/supabase/server.ts

import { createServerClient as createSupabaseClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// The function is now ASYNC to handle await for cookies
export async function createServerClient() {
  // We now AWAIT the cookie store
  const cookieStore = await cookies();

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
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // This can be ignored
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // This can be ignored
          }
        },
      },
    }
  );
}