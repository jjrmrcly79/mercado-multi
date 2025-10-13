import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Define a specific type for the data you intend to update
type StoreUpdatePayload = {
  primary_color: string;
  secondary_color: string;
  logo_url?: string; // logo_url is optional
};

export async function updateStoreSettings(formData: FormData) {
  const supabase = await createServerClient();

  const storeId = formData.get('storeId') as string;
  const slug = formData.get('slug') as string;
  const logoFile = formData.get('logo') as File | null; // Handle null case
  const primaryColor = formData.get('primary_color') as string;
  const secondaryColor = formData.get('secondary_color') as string;

  if (!storeId || !slug) {
    throw new Error('Store ID and slug are required');
  }

  let logoUrl: string | null = null;

  // Handle logo upload if a file is provided
  if (logoFile && logoFile.size > 0) {
    const filePath = `public/${storeId}/logo-${Date.now()}`;
    
    const { error: uploadError } = await supabase.storage
      .from('store-logos')
      .upload(filePath, logoFile, {
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error('Error uploading logo:', uploadError);
      throw new Error('Could not upload logo');
    }

    // Get the public URL of the uploaded file
    const { data } = supabase.storage
      .from('store-logos')
      .getPublicUrl(filePath);
    
    logoUrl = data.publicUrl;
  }

  // Build the object with the data to update
  const updates: StoreUpdatePayload = {
    primary_color: primaryColor,
    secondary_color: secondaryColor,
  };

  if (logoUrl) {
    updates.logo_url = logoUrl;
  }

  // Perform the database update
  const { error: dbError } = await supabase
    .from('stores')
    .update(updates)
    .eq('id', storeId);

  if (dbError) {
    console.error('Error updating store:', dbError);
    // You can throw an error to indicate failure
    throw new Error('Could not update store settings');
  }

  // Revalidate the path to show the updated data
  revalidatePath(`/dashboard/${slug}/settings`);


}