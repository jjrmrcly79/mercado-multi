// src/app/dashboard/[slug]/settings/_components/settings-form.tsx

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { updateStoreSettings } from '../actions'; // We will create this action next

// Define the type for the store prop
type Store = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export function SettingsForm({ store }: { store: Store }) {
  // State for the logo preview
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Handle logo file selection
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  return (
    <form action={updateStoreSettings} className="max-w-xl space-y-8">
      {/* Hidden input to pass the store ID to the server action */}
      <input type="hidden" name="storeId" value={store.id} />

      {/* Logo Upload Section */}
      <div>
        <label htmlFor="logo" className="block text-sm font-medium text-gray-700">
          Store Logo
        </label>
        <div className="mt-2 flex items-center gap-x-4">
          <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            {logoPreview ? (
              <Image
                src={logoPreview}
                alt="New logo preview"
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : store.logo_url ? (
              <Image
                src={store.logo_url}
                alt="Current logo"
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-gray-500">No Logo</span>
            )}
          </div>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png, image/jpeg"
            onChange={handleLogoChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      </div>

      {/* Color Palette Section */}
      <div className="flex gap-8">
        <div>
          <label htmlFor="primary_color" className="block text-sm font-medium text-gray-700">
            Primary Color
          </label>
          <input
            id="primary_color"
            name="primary_color"
            type="color"
            defaultValue={store.primary_color ?? '#000000'}
            className="mt-1 h-10 w-20"
          />
        </div>
        <div>
          <label htmlFor="secondary_color" className="block text-sm font-medium text-gray-700">
            Secondary Color
          </label>
          <input
            id="secondary_color"
            name="secondary_color"
            type="color"
            defaultValue={store.secondary_color ?? '#FFFFFF'}
            className="mt-1 h-10 w-20"
          />
        </div>
      </div>
      
      <button
        type="submit"
        className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
      >
        Save Changes
      </button>
    </form>
  );
}