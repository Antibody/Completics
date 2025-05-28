// app/api/tags/[tagId]/share-with-workspace/[workspaceId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const paramsSchema = z.object({
  tagId: z.string().uuid("Invalid Tag ID format in URL."),
  workspaceId: z.string().uuid("Invalid Workspace ID format in URL."),
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

interface TagWorkspaceParams {
  tagId: string;
  workspaceId: string;
}

// DELETE handler to unshare a tag from a workspace
export async function DELETE(
  _request: NextRequest, // Marked as unused
  context: { params: Promise<TagWorkspaceParams> }
): Promise<NextResponse> {
  const resolvedParams = await context.params;
  const paramsValidation = paramsSchema.safeParse(resolvedParams);

  if (!paramsValidation.success) {
    return NextResponse.json({ error: 'Invalid URL parameters.' }, { status: 400 });
  }
  const { tagId, workspaceId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
  }

  // RLS on shared_tag_access will ensure the user has permission
  // to delete this sharing entry (either creator or workspace owner).
  const { error, count } = await supabase
    .from('shared_tag_access')
    .delete({ count: 'exact' })
    .eq('tag_id', tagId)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error(`API tags/[${tagId}]/share-with-workspace/[${workspaceId}]/DELETE: Error unsharing tag:`, error);
    return NextResponse.json({ error: 'Failed to unshare tag due to a server error.' }, { status: 500 });
  }

  if (count === 0) {
    // This could mean the sharing permission wasn't found, or RLS prevented access.
    return NextResponse.json({ error: 'Tag sharing permission not found or access denied.' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 }); // Successfully removed, no content
}
