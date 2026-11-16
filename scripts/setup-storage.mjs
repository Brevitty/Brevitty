// Creates the private Supabase Storage bucket the Hub uploads into (idempotent; also re-applies
// the size + type limits on an existing bucket). Run once per Supabase project:
//   node scripts/setup-storage.mjs
import './lib/sheetSetup.mjs' // loads .env.local
import { createClient } from '@supabase/supabase-js'
import { FILE_TYPES, MAX_FILE_BYTES } from '../src/data/fileRules.js'

const missing = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_BUCKET'].filter((k) => !process.env[k]?.trim())
if (missing.length) {
  console.error(`Missing env var(s): ${missing.join(', ')}. Set them in .env.local.`)
  process.exit(1)
}

const bucket = process.env.SUPABASE_BUCKET.trim()
const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SECRET_KEY.trim(), { auth: { persistSession: false } })
// WEBP is only for the public registration form (logo / founder photo); the Hub's own rules (fileRules.js) don't accept it.
const REGISTRATION_EXTRA_TYPES = ['image/webp']
const options = { public: false, fileSizeLimit: MAX_FILE_BYTES, allowedMimeTypes: [...new Set([...Object.values(FILE_TYPES), ...REGISTRATION_EXTRA_TYPES])] }

const { data: existing } = await supabase.storage.getBucket(bucket)
const { error } = existing ? await supabase.storage.updateBucket(bucket, options) : await supabase.storage.createBucket(bucket, options)
if (error) {
  console.error(`Could not ${existing ? 'update' : 'create'} bucket "${bucket}": ${error.message}`)
  process.exit(1)
}
const { data } = await supabase.storage.getBucket(bucket)
console.log(`Bucket "${bucket}" ${existing ? 'updated' : 'created'}: public=${data.public}, limit=${data.file_size_limit} bytes, types=${data.allowed_mime_types.length}`)
