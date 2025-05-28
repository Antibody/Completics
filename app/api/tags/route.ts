// app/api/tags/route.ts
import { NextResponse } from 'next/server'; // Import NextRequest
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const tagSchema = z.object({
  name: z.string().trim().min(1, "Tag name is required.").max(100, "Tag name cannot exceed 100 characters."),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code (e.g., #RRGGBB).").nullable().optional(),
});

const createSupabaseRouteHandlerClient = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const store = await Promise.resolve(cookieStore);
          return store.getAll();
        },
        async setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          const store = await Promise.resolve(cookieStore);
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        },
      },
    }
  );
};

// GET handler to fetch tags for the authenticated user
export async function GET() { // Accept NextRequest, mark as unused
  // const { searchParams } = new URL(_request.url); // No longer needed
  // const workspaceId = searchParams.get('workspaceId'); // workspaceId is now handled client-side for filtering

  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('API tags/GET: Authentication error', authError);
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
  }

  const query = supabase // Changed to const
    .from('tags')
    .select('id, name, color, created_at, is_global, user_id') // Select user_id to identify owner
    .or(`user_id.eq.${user.id},is_global.eq.true`) // Fetch only user's own or global tags
    .order('name', { ascending: true });

  // RLS on 'tags' table will ensure the user can see tags shared with any workspace they have access to.
  // Client-side (LabelsManagerPopup) will filter further based on the specific workspaceId.

  const { data: tags, error } = await query;

  if (error) {
    console.error("API tags/GET: Error fetching tags:", error);
    return NextResponse.json({ error: 'Failed to fetch tags due to a server error.' }, { status: 500 });
  }

  return NextResponse.json(tags || []);
}

// POST handler to create a new tag for the authenticated user
export async function POST(request: Request) {
  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('API tags/POST: Authentication error', authError);
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (jsonError) {
    console.error("API tags/POST: Error parsing JSON body:", jsonError);
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationResult = tagSchema.safeParse(rawBody);

  if (!validationResult.success) {
    return NextResponse.json(
      { error: "Invalid request data." }, // Generic message, removed errors
      { status: 400 }
    );
  }
  
  const { name, color } = validationResult.data;

  const newTagData = {
    name,
    color: color || '#808080', // Default color if not provided
    user_id: user.id,
  };

  const { data, error: insertError } = await supabase
    .from('tags')
    .insert(newTagData)
    .select('id, name, color, created_at, user_id')
    .single();

  if (insertError) {
    console.error("API tags/POST: Error creating tag:", insertError);
    if (insertError.code === '23505') { // Unique constraint violation (e.g. user_id_name_key)
        return NextResponse.json({ error: "A tag with this name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create tag due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(data, { status: 201 });
}
