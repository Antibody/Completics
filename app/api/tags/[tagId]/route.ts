// app/api/tags/[tagId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const updateTagObjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tag name cannot be empty if provided.')
    .max(100, 'Tag name cannot exceed 100 characters.')
    .optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code (e.g., #RRGGBB).")
    .nullable()
    .optional(),
});

type UpdateTagInput = z.infer<typeof updateTagObjectSchema>;

const updateTagSchema = updateTagObjectSchema.refine(
  (data: UpdateTagInput) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for an update.' }
);

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

interface TagParams {
  tagId: string;
}

// PUT handler to update a specific tag by ID
export async function PUT(
  request: NextRequest,
  context: unknown
): Promise<NextResponse> {
  const params = (context as { params: TagParams }).params;
  const { tagId } = params;

  if (!tagId) {
    return NextResponse.json({ error: 'Tag ID is required.' }, { status: 400 });
  }

  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (jsonError) {
    console.error(`API tags/[${tagId}]/PUT: Error parsing JSON body:`, jsonError);
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const validationResult = updateTagSchema.safeParse(rawBody);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid request data.' }, // Generic message, removed errors
      { status: 400 }
    );
  }

  const updateFields = validationResult.data;

  // RLS policy "Users can manage their own tags" will ensure user_id matches auth.uid()
  const { data, error } = await supabase
    .from('tags')
    .update(updateFields)
    .eq('id', tagId)
    // .eq('user_id', user.id) // RLS handles this, but explicit check can be added for extra safety
    .select('id, name, color, created_at, user_id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // No record found or RLS denied
      return NextResponse.json({ error: 'Tag not found or access denied to update.' }, { status: 404 });
    }
    if (error.code === '23505') { // Unique constraint violation (e.g. user_id_name_key)
        return NextResponse.json({ error: "A tag with this name already exists for your account." }, { status: 409 });
    }
    console.error(`API tags/[${tagId}]/PUT: Error updating tag:`, error);
    return NextResponse.json({ error: 'Failed to update tag due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(data);
}

// DELETE handler to delete a specific tag by ID
export async function DELETE(
  _request: NextRequest, // Marked as unused
  context: unknown
): Promise<NextResponse> {
  const params = (context as { params: TagParams }).params;
  const { tagId } = params;

  if (!tagId) {
    return NextResponse.json({ error: 'Tag ID is required.' }, { status: 400 });
  }
  
  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  // RLS policy "Users can manage their own tags" will ensure user_id matches auth.uid()
  // ON DELETE CASCADE on task_tags.tag_id will remove associations.
  const { error, count } = await supabase
    .from('tags')
    .delete({ count: 'exact' })
    .eq('id', tagId);
    // .eq('user_id', user.id); // RLS handles this

  if (error) {
    console.error(`API tags/[${tagId}]/DELETE: Error deleting tag:`, error);
    return NextResponse.json({ error: 'Failed to delete tag due to a server error.' }, { status: 500 }); // Generic message
  }
  if (count === 0) {
    return NextResponse.json({ error: 'Tag not found or access denied to delete.' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 }); // Successfully deleted, no content
}
