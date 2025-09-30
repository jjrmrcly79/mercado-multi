// src/app/dashboard/[slug]/settings/page.tsx

import { createServerClient } from '@/lib/supabase/server';
import { SettingsForm } from './_components/settings-form';
import { notFound } from 'next/navigation';

export default async function StoreSettingsPage(props: {
  params: { slug: string };
}) {
  // --- FORCED AWAIT FIX ---
  // This line forces the function to pause, ensuring props are ready.
  await new Promise(resolve => setTimeout(resolve, 0));

  const slug = props.params.slug;

  const supabase = await createServerClient();

  const { data: store, error } = await supabase
    .from('stores')
    .select('id, slug, name, logo_url, primary_color, secondary_color')
    .eq('slug', slug)
    .single();

  if (error || !store) {
    notFound();
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Store Settings</h1>
      <p className="mb-6 text-gray-500">
        Update your store's logo and brand colors.
      </p>
      <SettingsForm store={store} />
    </div>
  );
}