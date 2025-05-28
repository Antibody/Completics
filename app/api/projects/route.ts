// app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { createServerClient/* , type CookieOptions */ } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod'; // Import Zod

// Zod schema for creating/updating a project
const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required.").max(255, "Project name cannot exceed 255 characters."),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters.").nullable().optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code (e.g., #RRGGBB).").nullable().optional(),
  start_date: z.string().datetime({ message: "Invalid start date format. Use ISO 8601." }).nullable().optional(),
  finish_date: z.string().datetime({ message: "Invalid finish date format. Use ISO 8601." }).nullable().optional(),
});


// GET handler to fetch projects for the authenticated user
export async function GET() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const store = await Promise.resolve(cookieStore);
          return store.getAll();
        },
        async setAll(cookiesToSet) {
          const store = await Promise.resolve(cookieStore);
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('API projects/GET: Authentication error', authError);
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  // RLS will ensure only the user's projects are returned.
  // user_id is implicitly applied by RLS based on the session.
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, description, color, created_at, start_date, finish_date')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("API projects GET error:", error);
    return NextResponse.json({ error: 'Failed to fetch projects due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(projects);
}

// POST handler to create a new project for the authenticated user
export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const store = await Promise.resolve(cookieStore);
          return store.getAll();
        },
        async setAll(cookiesToSet) {
          const store = await Promise.resolve(cookieStore);
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('API projects/POST: Authentication error', authError);
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  const userId = user.id;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (jsonError) {
    console.error("API projects/POST: Error parsing JSON body:", jsonError);
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationResult = projectSchema.safeParse(rawBody);

  if (!validationResult.success) {
    return NextResponse.json(
      { error: "Invalid request data." }, // Generic message, removed errors
      { status: 400 }
    );
  }
  
  // Use validated data. Ensure all fields from schema are included, even if optional.
  const { 
    name, 
    description, 
    color, 
    start_date, 
    finish_date 
  } = validationResult.data;

  const newProjectData = {
    name, // Already trimmed by Zod
    description: description || null, // Ensure null if undefined
    color: color || null,
    start_date: start_date || null,
    finish_date: finish_date || null,
    user_id: userId,
  };

  const { data, error: insertError } = await supabase
    .from('projects')
    .insert(newProjectData)
    .select('id, name, description, color, created_at, start_date, finish_date, user_id')
    .single(); // Assuming we want to return the single created project

  if (insertError) {
    console.error("API projects POST error:", insertError);
    // Provide more specific error if RLS or NOT NULL constraint failed for user_id
    if (insertError.message.includes('null value in column "user_id"')) {
        return NextResponse.json({ error: "Failed to associate project with user. User ID is missing." }, { status: 500 });
    }
    if (insertError.message.includes('row level security')) {
        return NextResponse.json({ error: "Failed to create project due to security policy." }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to create project due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(data, { status: 201 });
}
