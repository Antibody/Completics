// app/api/workspaces/[workspaceId]/shared-tags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const paramsSchema = z.object({
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

interface WorkspaceParams {
  workspaceId: string;
}

// GET handler to fetch shared_tag_access for a specific workspace
export async function GET(
  request: NextRequest,
  context: { params: Promise<WorkspaceParams> }
): Promise<NextResponse> {
  const resolvedParams = await context.params;
  const paramsValidation = paramsSchema.safeParse(resolvedParams);

  if (!paramsValidation.success) {
    return NextResponse.json({ error: 'Invalid URL parameters.' }, { status: 400 });
  }
  const { workspaceId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
  }

  // RLS on 'shared_tag_access' will ensure the user has access to this workspace's sharing info.
  const { data: sharedTags, error } = await supabase
    .from('shared_tag_access')
    .select('tag_id')
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error(`API workspaces/[${workspaceId}]/shared-tags/GET: Error fetching shared tags:`, error);
    return NextResponse.json({ error: 'Failed to fetch shared tags due to a server error.' }, { status: 500 });
  }

  // Return just the tag_ids that are shared with this workspace
  return NextResponse.json(sharedTags.map(st => st.tag_id) || []);
}
