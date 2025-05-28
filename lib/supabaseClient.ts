import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL is not defined. Please check your .env.local file.');
  throw new Error('Missing Supabase URL. Check server logs for more details.');
}

if (!supabaseKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. Please check your .env.local file.');
  throw new Error('Missing Supabase Anon Key. Check server logs for more details.');
}

try {

  new URL(supabaseUrl); 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_e) {
  console.error(`ERROR: Invalid NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}". It must be a valid URL (e.g., https://your-project-id.supabase.co).`);
  throw new Error('Invalid Supabase URL format. Check server logs for more details.');
}


const supabase = createBrowserClient(supabaseUrl, supabaseKey);

export default supabase;
