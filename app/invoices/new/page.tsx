'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function NewInvoice() {
  const [image, setImage] = useState<File | null>(null);
  const [supplierId, setSupplierId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImage(file);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !supplierId) {
      setError('Please select an image and a supplier');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Resize image client-side (max edge 1600px)
      const resizedImage = await resizeImage(image, 1600);

      // Upload to Supabase Storage under org_id folder
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profileError) throw profileError;
      const orgId = profileData.org_id;
      if (!orgId) {
        throw new Error('No organization found for user');
      }

      const filePath = `${orgId}/${Date.now()}-${image.name}`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, resizedImage, {
          contentType: image.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL (for private bucket, we need to create a signed URL)
      const { data: { publicUrl } } = await supabase.storage
        .from('invoices')
        .getPublicUrl(filePath);

      // Insert invoice record
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          org_id: orgId,
          supplier_id: supplierId,
          image_path: publicUrl,
          invoice_date: new Date().toISOString().split('T')[0],
          total: 0, // will be updated after parsing
          parse_status: 'pending',
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // TODO: Call parse API (we'll implement this later)
      // For now, just redirect to the invoice page
      router.push(`/invoices/${invoiceData.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'An unexpected error occurred');
    } finally {
      setUploading(false);
    }
  }, [image, supplierId, router]);

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Upload Invoice</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Supplier</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            required
          >
            <option value="">Select a supplier</option>
            <option value="sysco">Sysco</option>
            <option value="usfoods">US Foods</option>
            <option value="localproduce">Local Produce Co</option>
            <option value="restaurantdepot">Restaurant Depot</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Invoice Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full px-3 py-2 border rounded"
            required
          />
          {image && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {image.name}
            </p>
          )}
        </div>
        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-800 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 mb-4 bg-green-50 border border-green-200 text-green-800 rounded">
            {success}
          </div>
        )}
        <button
          type="submit"
          disabled={uploading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload Invoice'}
        </button>
      </form>
    </div>
  );
}

// Simple image resize function (maintains aspect ratio, max edge 1600px)
function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas is empty'));
        },
        file.type,
        0.9 // quality
      );
    };
    img.onerror = (err) => {
      reject(new Error(`Failed to load image: ${err}`));
    };
    img.src = URL.createObjectURL(file);
  });
}