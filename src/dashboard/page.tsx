import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await getServerSupabase(); // 👈 añade await
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, name, slug")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>Hola, <b>{user.email}</b></p>

      <a href="/dashboard/new" className="inline-block rounded bg-black px-3 py-2 text-white">Nueva tienda</a>

      {error && <p className="text-red-600">{error.message}</p>}
      <ul className="space-y-2">
        {(stores ?? []).map((s) => (
          <li key={s.id} className="rounded border bg-white p-3">
            <b>{s.name}</b> — <code>/{s.slug}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
