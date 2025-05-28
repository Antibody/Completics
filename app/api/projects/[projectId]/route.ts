// app/api/projects/[projectId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*  Validation schemas for Projects                                           */
/* -------------------------------------------------------------------------- */
const updateProjectObjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Project name cannot be empty if provided.')
    .max(255, 'Project name cannot exceed 255 characters.')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters.')
    .nullable()
    .optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code (e.g., #RRGGBB).")
    .nullable()
    .optional(),
  start_date: z
    .string()
    .datetime({ message: "Invalid start date format. Use ISO 8601." })
    .nullable()
    .optional(),
  finish_date: z
    .string()
    .datetime({ message: 'Invalid finish date format. Use ISO 8601.' })
    .nullable()
    .optional(),
});

const paramsSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format in URL."),
});

type UpdateProjectInput = z.infer<typeof updateProjectObjectSchema>;

const updateProjectSchema = updateProjectObjectSchema.refine(
  (data: UpdateProjectInput) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for an update.' }
);

/* -------------------------------------------------------------------------- */
/*  Supabase helper                                                           */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*  GET handler to fetch a specific project by ID                             */
/* -------------------------------------------------------------------------- */
export async function GET(
  request: NextRequest, 
  context: { params: Promise<{ projectId: string }> } // Context type from Next.js
): Promise<NextResponse> {
  void request; 
  // Await the params object to resolve the Promise
  const resolvedParams = await context.params;

  // Validate URL parameters
  const paramsValidation = paramsSchema.safeParse(resolvedParams);
  if (!paramsValidation.success) {
    return NextResponse.json(
      { error: 'Invalid URL parameters.' }, // Generic message, removed errors
      { status: 400 }
    );
  }
  const { projectId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const {
    data: { user }, // Changed from session to user
    error: authError, // Changed from sessionError to authError
  } = await supabase.auth.getUser(); 
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication failed.' }, // Generic message
      { status: 401 }
    );
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, description, color, start_date, finish_date, created_at') // Adjusted fields
    .eq('id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // No record found or RLS denied
      return NextResponse.json(
        { error: 'Project not found or access denied.' }, // Changed message
        { status: 404 }
      );
    }
    console.error('API projects/[projectId] GET error:', error); // Changed log message
    return NextResponse.json({ error: 'Failed to fetch project due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(project);
}

/* -------------------------------------------------------------------------- */
/*  PUT handler to update a specific project by ID                            */
/* -------------------------------------------------------------------------- */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> } // Context type from Next.js
): Promise<NextResponse> {
  // Await the params object to resolve the Promise
  const resolvedParams = await context.params;

  // Validate URL parameters
  const paramsValidation = paramsSchema.safeParse(resolvedParams);
  if (!paramsValidation.success) {
    return NextResponse.json(
      { error: 'Invalid URL parameters.' }, // Generic message, removed errors
      { status: 400 }
    );
  }
  const { projectId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const {
    data: { user }, // Changed from session to user
    error: authError, // Changed from sessionError to authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication failed.' }, // Generic message
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (jsonError) {
    console.error('API projects/[projectId] PUT: Error parsing JSON body:', jsonError); // Changed log
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const validationResult = updateProjectSchema.safeParse(rawBody); // Use updateProjectSchema
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid request data.' }, // Generic message, removed errors
      { status: 400 }
    );
  }

  const updateFields = validationResult.data;

  const { data, error } = await supabase
    .from('projects')
    .update(updateFields)
    .eq('id', projectId)
    .select('id, name, description, color, start_date, finish_date, created_at') // Adjusted fields
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // No record found or RLS denied
      return NextResponse.json(
        { error: 'Project not found or access denied to update.' }, // Changed message
        { status: 404 }
      );
    }
    console.error('API projects/[projectId] PUT error:', error); // Changed log
    return NextResponse.json({ error: 'Failed to update project due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(data);
}

/* -------------------------------------------------------------------------- */
/*  DELETE handler to delete a specific project by ID                         */
/* -------------------------------------------------------------------------- */
export async function DELETE(
  request: NextRequest, 
  context: { params: Promise<{ projectId: string }> } // Context type from Next.js
): Promise<NextResponse> {
  void request;
  // Await the params object to resolve the Promise
  const resolvedParams = await context.params;

  // Validate URL parameters
  const paramsValidation = paramsSchema.safeParse(resolvedParams);
  if (!paramsValidation.success) {
    return NextResponse.json(
      { error: 'Invalid URL parameters.' }, // Generic message, removed errors
      { status: 400 }
    );
  }
  const { projectId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const {
    data: { user }, // Changed from session to user
    error: authError, // Changed from sessionError to authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication failed.' }, // Generic message
      { status: 401 }
    );
  }

  const { error, count } = await supabase
    .from('projects')
    .delete({ count: 'exact' })
    .eq('id', projectId);

  if (error) {
    console.error('API projects/[projectId] DELETE error:', error); // Changed log
    return NextResponse.json({ error: 'Failed to delete project due to a server error.' }, { status: 500 }); // Generic message
  }
  if (count === 0) {
    return NextResponse.json(
      { error: 'Project not found or access denied to delete.' }, // Changed message
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
