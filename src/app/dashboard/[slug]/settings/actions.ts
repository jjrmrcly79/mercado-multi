// src/app/dashboard/[slug]/settings/actions.ts

'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateStoreSettings(formData: FormData) {
  // --- FIX IS HERE ---
  const supabase = await createServerClient();

  const storeId = formData.get('storeId') as string;
  const logoFile = formData.get('logo') as File;
  const primaryColor = formData.get('primary_color') as string;
  const secondaryColor = formData.get('secondary_color') as string;

  if (!storeId) {
    throw new Error('Store ID is required');
  }

  let logoUrl = null;

  if (logoFile && logoFile.size > 0) {
    const filePath = `public/${storeId}/logo-${Date.now()}.${logoFile.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage
      .from('store-logos')
      .upload(filePath, logoFile, {
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading logo:', uploadError);
      throw new Error('Could not upload logo');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('store-logos')
      .getPublicUrl(filePath);
    
    logoUrl = publicUrl;
  }

  const updates: { [key: string]: any } = {
    primary_color: primaryColor,
    secondary_color: secondaryColor,
  };

  if (logoUrl) {
    updates.logo_url = logoUrl;
  }

  const { error: dbError } = await supabase
    .from('stores')
    .update(updates)
    .eq('id', storeId);

  if (dbError) {
    console.error('Error updating store:', dbError);
    throw new Error('Could not update store settings');
  }

  revalidatePath(`/dashboard/${storeId}/settings`);
}