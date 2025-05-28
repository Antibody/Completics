// app/api/tags/[tagId]/share-with-workspace/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const paramsSchema = z.object({
  tagId: z.string().uuid("Invalid Tag ID format in URL."),
});

const shareTagSchema = z.object({
  workspace_id: z.string().uuid("Invalid Workspace ID format."),
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

interface TagParams {
  tagId: string;
}

// POST handler to share a tag with a workspace
export async function POST(
  request: NextRequest,
  context: { params: Promise<TagParams> }
): Promise<NextResponse> {
  const resolvedParams = await context.params;
  const paramsValidation = paramsSchema.safeParse(resolvedParams);

  if (!paramsValidation.success) {
    return NextResponse.json({ error: 'Invalid URL parameters.' }, { status: 400 });
  }
  const { tagId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (jsonError) {
    console.error(`API tags/[${tagId}]/share-with-workspace/POST: Error parsing JSON body:`, jsonError);
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const validationResult = shareTagSchema.safeParse(rawBody);
  if (!validationResult.success) {
    return NextResponse.json({ error: 'Invalid request data.' }, { status: 400 });
  }
  const { workspace_id } = validationResult.data;

  // RLS on shared_tag_access will ensure the user owns the tag
  // and has permission to share with the target workspace.
  const { data, error: insertError } = await supabase
    .from('shared_tag_access')
    .insert({
      tag_id: tagId,
      workspace_id: workspace_id,
      shared_by_user_id: user.id, // Track who shared it
    })
    .select()
    .single();

  if (insertError) {
    console.error(`API tags/[${tagId}]/share-with-workspace/POST: Error sharing tag:`, insertError);
     if (insertError.code === '23503') { // Foreign key violation
        return NextResponse.json({ error: "Failed to share tag: Tag or Workspace not found, or you don't have permission." }, { status: 404 });
    }
    if (insertError.code === '23505') { // Unique constraint violation (already shared)
        return NextResponse.json({ error: "This tag is already shared with this workspace." }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to share tag due to a server error.' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 }); // 201 Created
}
