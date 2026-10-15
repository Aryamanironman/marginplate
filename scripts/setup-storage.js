require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function setupStorage() {
  // Try to create the invoices bucket (private)
  const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('invoices');

  if (bucketError && bucketError.status !== 404) {
    console.error('Error checking bucket:', bucketError);
    return;
  }

  if (!bucketData) {
    const { error: createError } = await supabase.storage.createBucket('invoices', {
      public: false, // private bucket
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });

    if (createError) {
      console.error('Error creating bucket:', createError);
      return;
    }
    console.log('Bucket "invoices" created');
  } else {
    console.log('Bucket "invoices" already exists');
  }

  // Set up storage policy to allow users to only access their own org's folder
  // We need to insert a policy into the storage.policies table
  // Note: The storage policies are defined in the `storage` schema.
  // We'll output the SQL for the policy so they can run it in the SQL editor.

  console.log(`
    To set up the storage policy, run the following SQL in your Supabase SQL editor:

    create policy "org_isolation_invoices" on storage.objects
    for all
    using ( (owner)::uuid = auth.uid() and (storage.foldername(name))[1] = (select org_id from profiles where id = auth.uid())::text )
    with check ( (owner)::uuid = auth.uid() and (storage.foldername(name))[1] = (select org_id from profiles where id = auth.uid())::text );

    This policy assumes that files are stored in the format: <org_id>/<fileName>
  `);
}

setupStorage().catch(console.error);