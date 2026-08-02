-- Fix: ensure storage policies allow admin uploads to store-products
-- Run this in Supabase SQL Editor if uploads fail

-- Allow authenticated users to upload to store-products folder
CREATE POLICY "Allow admin upload to store-products"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sprites'
  AND (storage.foldername(name))[1] = 'store-products'
);

-- Allow anyone to view store-products
CREATE POLICY "Allow public read store-products"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'sprites'
  AND (storage.foldername(name))[1] = 'store-products'
);
