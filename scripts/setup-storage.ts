import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function setupStorage() {
  // Create the invoices bucket if it doesn't exist
  const { data: bucketData, error: bucketError } = await supabase.storage
    .getBucket('invoices')

  if (bucketError && bucketError.status !== 404) {
    console.error('Error checking bucket:', bucketError)
    return
  }

  if (!bucketData) {
    const { error: createError } = await supabase.storage.createBucket('invoices', {
      public: false, // private bucket
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
    if (createError) {
      console.error('Error creating bucket:', createError)
      return
    }
    console.log('Bucket "invoices" created')
  } else {
    console.log('Bucket "invoices" already exists')
  }

  // Set up storage policy to allow users to only access their own org's folder
  // We need to insert a policy into the storage.policies table
  // Note: The storage policies are defined in the `storage` schema.
  // We'll use the Supabase SQL API to insert the policy.
  // However, we can also define it via the dashboard. Let's do it via SQL for consistency.

  // We'll use the supabase client to run a raw SQL query.
  const policySql = `
    create policy "org_isolation_invoices" on storage.objects
    for all
    using ( (owner)::uuid = auth.uid() and (storage.foldername(name))[1] = (select org_id from profiles where id = auth.uid())::text )
    with check ( (owner)::uuid = auth.uid() and (storage.foldername(name))[1] = (select org_id from profiles where id = auth.uid())::text );
  `

  // But note: the storage.objects table does not have an org_id column. We need to use the bucket name and the folder structure.
  // We will store files in the format: <org_id>/<fileName>
  // So we can check that the first segment of the file path (the org_id) matches the user's org_id.

  // However, the storage policies in Supabase are defined via the `storage.policies` table and we can use the `auth.uid()` and the `storage.foldername` function.
  // Let's check if the policy already exists.

  // We'll instead create a policy via the Supabase management API? It's easier to do via the dashboard.

  // Given the complexity, we'll skip the automatic policy creation and instruct the user to set it up in the dashboard.
  // We'll output the SQL for the policy so they can run it in the SQL editor.

  console.log(`
    To set up the storage policy, run the following SQL in your Supabase SQL editor:

    create policy "org_isolation_invoices" on storage.objects
    for all
    using ( (owner)::uuid = auth.uid() and (storage.foldername(name))[1] = (select org_id from profiles where id = auth.uid())::text )
    with check ( (owner)::uuid = auth.uid() and (storage.foldername(name))[1] = (select org_id from profiles where id = auth.uid())::text );

    This policy assumes that files are stored in the format: <org_id>/<fileName>
  `)
}

setupStorage().catch(console.error)