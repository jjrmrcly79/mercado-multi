"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) { router.replace("/login"); return; }
      setEmail(user.email ?? null);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [router]);

  if (loading) return <p>Entrando…</p>;
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>Hola, <b>{email}</b></p>
      <form action="/auth/signout" method="post">
        <button className="rounded bg-black px-3 py-2 text-white">Cerrar sesión</button>
      </form>
    </div>
  );
}
