// src/app/start/page.tsx
import Link from "next/link";

export default function StartPage() {
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <h1 className="text-3xl font-bold">Crea tu tienda en minutos</h1>
      <p className="text-lg text-gray-600">
        Sube tu logo, describe tus productos y dejamos que la IA proponga tu paleta, misión y visión.
      </p>

      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>Identidad visual generada con IA (paleta, misión, visión)</li>
        <li>Variantes de productos, carrito y checkout con Stripe</li>
        <li>Publicación por <code>slug</code> y secciones personalizables</li>
      </ul>

      <div>
        <Link
          href="/login?next=/dashboard/new"
          className="inline-block rounded-xl bg-black px-5 py-3 text-white hover:opacity-90"
        >
          Crear mi tienda
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        ¿Ya tienes cuenta? <Link className="underline" href="/login?next=/dashboard/new">Inicia sesión</Link>
      </p>
    </main>
  );
}
