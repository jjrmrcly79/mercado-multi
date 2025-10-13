// src/components/nav/RootNavbar.tsx
"use client";

export default function RootNavbar() {
  return (
    <header className="w-full border-b">
      <div className="max-w-5xl mx-auto flex items-center justify-between p-4">
        <a href="/" className="font-semibold">mercado-multi</a>
        <nav className="text-sm flex gap-4">
          <a href="/docs" className="hover:underline">Docs</a>
          <a href="/dashboard" className="hover:underline">Dashboard</a>
        </nav>
      </div>
    </header>
  );
}
