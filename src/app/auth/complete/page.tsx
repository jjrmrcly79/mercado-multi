"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function Complete() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const hash = window.location.hash; // #access_token=...&refresh_token=...
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        // limpia el hash para evitar repetir
        window.history.replaceState({}, "", "/dashboard");
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
    run();
  }, [router]);

  return <p>Completando inicio de sesión…</p>;
}
