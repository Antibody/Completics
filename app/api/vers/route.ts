// app/api/vers/route.ts
import { NextResponse } from 'next/server';
import { createServerClient/* , type CookieOptions */ } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod'; // Import Zod

// Zod schema for creating a ver
const createVerSchema = z.object({
  name: z.string().trim().min(1, "Ver name is required.").max(255, "Ver name cannot exceed 255 characters."),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters.").nullable().optional(),
  status: z.string().trim().max(50, "Status cannot exceed 50 characters.").nullable().optional(), // Consider z.enum if predefined statuses
  start_date: z.string().datetime({ message: "Invalid start date format. Use ISO 8601." }).nullable().optional(),
  release_date: z.string().datetime({ message: "Invalid release date format. Use ISO 8601." }).nullable().optional(),
  project_id: z.string().uuid("Invalid project ID format.").nullable().optional(), // <-- NEW FIELD
});

// Helper function to create Supabase client for route handlers (can be shared if moved to a common util)
const createSupabaseRouteHandlerClient = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const store = await Promise.resolve(cookieStore); // Explicitly resolve, though cookies() should be sync
          return store.getAll();
        },
        async setAll(cookiesToSet) {
          const store = await Promise.resolve(cookieStore); // Explicitly resolve
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        },
      },
    }
  );
};

// GET handler to fetch vers for the authenticated user
export async function GET() {
  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('API vers/GET: Authentication error', authError);
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  // RLS will ensure only the user's vers are returned.
  const { data: vers, error } = await supabase
    .from('vers')
    .select('id, name, description, status, start_date, release_date, created_at, project_id') // <-- Add project_id
    .order('release_date', { ascending: false, nullsFirst: false }) // Keep nulls at the end or beginning consistently
    .order('name', { ascending: true });

  if (error) {
    console.error("API vers GET error:", error);
    return NextResponse.json({ error: 'Failed to fetch vers due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(vers);
}

// POST handler to create a new ver for the authenticated user
export async function POST(request: Request) {
  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('API vers/POST: Authentication error', authError);
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  const userId = user.id;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (jsonError) {
    console.error("API vers/POST: Error parsing JSON body:", jsonError);
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationResult = createVerSchema.safeParse(rawBody);

  if (!validationResult.success) {
    return NextResponse.json(
      { error: "Invalid request data." }, // Generic message, removed errors
      { status: 400 }
    );
  }
  
  const { 
    name, 
    description, 
    status,
    start_date,
    release_date,
    project_id // <-- Destructure new field
  } = validationResult.data;

  const newVerData = {
    name, // Already trimmed by Zod
    description: description || null,
    status: status || null,
    start_date: start_date || null,
    release_date: release_date || null,
    user_id: userId,
    project_id: project_id || null, // <-- Add to insert data
  };

  const { data, error: insertError } = await supabase
    .from('vers')
    .insert(newVerData)
    .select('id, name, description, status, start_date, release_date, created_at, user_id, project_id') // <-- Add project_id to select
    .single();

  if (insertError) {
    console.error("API vers POST error:", insertError);
     if (insertError.message.includes('null value in column "user_id"')) {
        return NextResponse.json({ error: "Failed to associate ver with user. User ID is missing." }, { status: 500 });
    }
    if (insertError.message.includes('row level security')) {
        return NextResponse.json({ error: "Failed to create ver due to security policy." }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to create ver due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(data, { status: 201 });
}
