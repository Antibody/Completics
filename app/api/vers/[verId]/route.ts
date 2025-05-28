// app/api/vers/[verId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*  Validation schemas for Vers                                               */
/* -------------------------------------------------------------------------- */
const updateVerObjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Ver name cannot be empty if provided.')
    .max(255, 'Ver name cannot exceed 255 characters.')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters.')
    .nullable()
    .optional(),
  status: z // Added status field, assuming vers have a status
    .string()
    .trim()
    .max(50, "Status cannot exceed 50 characters.")
    .nullable()
    .optional(),
  start_date: z
    .string()
    .datetime({ message: 'Invalid start date format. Use ISO 8601.' })
    .nullable()
    .optional(),
  release_date: z // Changed from finish_date to release_date for vers
    .string()
    .datetime({ message: 'Invalid release date format. Use ISO 8601.' })
    .nullable()
    .optional(),
  project_id: z.string().uuid("Invalid project ID format.").nullable().optional(), // <-- NEW FIELD
});

const paramsSchema = z.object({
  verId: z.string().uuid("Invalid Ver ID format in URL."),
});

type UpdateVerInput = z.infer<typeof updateVerObjectSchema>;

const updateVerSchema = updateVerObjectSchema.refine(
  (data: UpdateVerInput) => Object.keys(data).length > 0,
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
/*  GET handler to fetch a specific ver by ID                                 */
/* -------------------------------------------------------------------------- */
export async function GET(
  request: NextRequest, 
  context: { params: Promise<{ verId: string }> } // Context type from Next.js
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
  const { verId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const {
    data: { user }, 
    error: authError, 
  } = await supabase.auth.getUser(); 
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication failed.' }, // Generic message
      { status: 401 }
    );
  }

  const { data: ver, error } = await supabase
    .from('vers') 
    .select('id, name, description, status, start_date, release_date, created_at, project_id')  // <-- Add project_id
    .eq('id', verId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { 
      return NextResponse.json(
        { error: 'Ver not found or access denied.' }, 
        { status: 404 }
      );
    }
    console.error('API vers/[verId] GET error:', error); 
    return NextResponse.json({ error: 'Failed to fetch ver due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(ver);
}

/* -------------------------------------------------------------------------- */
/*  PUT handler to update a specific ver by ID                                */
/* -------------------------------------------------------------------------- */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ verId: string }> } // Context type from Next.js
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
  const { verId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const {
    data: { user }, 
    error: authError, 
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
    console.error('API vers/[verId] PUT: Error parsing JSON body:', jsonError); 
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const validationResult = updateVerSchema.safeParse(rawBody); 
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid request data.' }, // Generic message, removed errors
      { status: 400 }
    );
  }

  const updateFields = validationResult.data;

  const { data, error } = await supabase
    .from('vers') 
    .update(updateFields)
    .eq('id', verId)
    .select('id, name, description, status, start_date, release_date, created_at, project_id') // <-- Add project_id
    .single();

  if (error) {
    if (error.code === 'PGRST116') { 
      return NextResponse.json(
        { error: 'Ver not found or access denied to update.' }, 
        { status: 404 }
      );
    }
    console.error('API vers/[verId] PUT error:', error); 
    return NextResponse.json({ error: 'Failed to update ver due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(data);
}

/* -------------------------------------------------------------------------- */
/*  DELETE handler to delete a specific ver by ID                             */
/* -------------------------------------------------------------------------- */
export async function DELETE(
  request: NextRequest, 
  context: { params: Promise<{ verId: string }> } // Context type from Next.js
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
  const { verId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const {
    data: { user }, 
    error: authError, 
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication failed.' }, // Generic message
      { status: 401 }
    );
  }

  const { error, count } = await supabase
    .from('vers') 
    .delete({ count: 'exact' })
    .eq('id', verId);

  if (error) {
    console.error('API vers/[verId] DELETE error:', error); 
    return NextResponse.json({ error: 'Failed to delete ver due to a server error.' }, { status: 500 }); // Generic message
  }
  if (count === 0) {
    return NextResponse.json(
      { error: 'Ver not found or access denied to delete.' }, 
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
