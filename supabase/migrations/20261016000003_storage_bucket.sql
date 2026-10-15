-- Create the invoices bucket if it doesn't exist
DO $$
BEGIN
  PERFORM 1 FROM storage.buckets WHERE name = 'invoices';
  IF NOT FOUND THEN
    INSERT INTO storage.buckets (name, public, file_size_limit, allowed_mime_types)
    VALUES ('invoices', false, 5 * 1024 * 1024, ARRAY['image/jpeg', 'image/png', 'image/webp']);
  END IF;
END $$;

-- Set up the storage policy for the invoices bucket
-- We assume files are stored in the format: <org_id>/<fileName>
CREATE POLICY IF NOT EXISTS org_isolation_invoices ON storage.objects
FOR ALL
USING ( (owner)::uuid = auth.uid() and (storage.foldername(name))[1] = (select org_id from profiles where id = auth.uid())::text )
WITH CHECK ( (owner)::uuid = auth.uid() and (storage.foldername(name))[1] = (select org_id from profiles where id = auth.uid())::text );