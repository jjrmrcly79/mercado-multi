"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function Complete() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // 1) Leer tokens del hash
      const hash = window.location.hash; // #access_token=...&refresh_token=...
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (!access_token || !refresh_token) {
        router.replace("/login");
        return;
      }

      // 2) Guardar sesión en supabase-js (LocalStorage)
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        console.error("setSession error:", error.message);
        router.replace("/login");
        return;
      }

      // 3) Confirmar que ya hay usuario y limpiar el hash
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        window.history.replaceState({}, "", "/dashboard");
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    })();
  }, [router]);

  return <p>Completando inicio de sesión…</p>;
}
