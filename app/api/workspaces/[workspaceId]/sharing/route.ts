// app/api/workspaces/[workspaceId]/sharing/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod'; // Import Zod for validation

const shareWorkspaceSchema = z.object({
  shareMode: z.enum(['read-only', 'editable']).optional().default('read-only'),
});

const paramsSchema = z.object({
  workspaceId: z.string().uuid("Invalid Workspace ID format in URL."),
});

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
/*  POST handler to enable sharing for a workspace                            */
/* -------------------------------------------------------------------------- */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> } // Context type from Next.js
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
  const { workspaceId } = paramsValidation.data;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error) {
    // If no body is provided, default to read-only.
    // If body is provided but malformed, it's an error.
    // This check is basic; a more robust solution might check Content-Type.
    if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > 0) {
      console.error('API sharing POST: Failed to parse JSON body:', error);
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    rawBody = {}; // Default to empty object if no body
  }
  
  const validationResult = shareWorkspaceSchema.safeParse(rawBody);

  if (!validationResult.success) {
    return NextResponse.json(
      { error: "Invalid request data." }, // Generic message, removed errors
      { status: 400 }
    );
  }

  const { shareMode } = validationResult.data;

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

  try {
    // 1. Verify ownership (RLS implicitly handles this on select)
    const { data: workspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('id, user_id, share_token, is_shared_publicly') // Select existing share info too
      .eq('id', workspaceId)
      .eq('user_id', user.id) // Explicit check, though RLS should cover it
      .single();

    if (fetchError || !workspace) {
      console.error(`API sharing POST: Error fetching workspace ${workspaceId} for user ${user.id}`, fetchError);
      return NextResponse.json(
        { error: 'Workspace not found or you do not have permission to share it.' },
        { status: 404 }
      );
    }

    // 2. Generate or reuse token
    const shareToken = workspace.share_token || uuidv4();
    // shareMode is now from validated request body

    // 3. Update the workspace record
    const { error: updateError } = await supabase
      .from('workspaces')
      .update({
        share_token: shareToken,
        is_shared_publicly: true,
        public_share_mode: shareMode, // Use the shareMode from request
      })
      .eq('id', workspaceId);

    if (updateError) {
      console.error(`API sharing POST: Error updating workspace ${workspaceId} for sharing`, updateError);
      return NextResponse.json(
        { error: 'Failed to enable sharing due to a server error.' }, // Generic message
        { status: 500 }
      );
    }

    // 4. Construct the shareable link
    // Use NEXT_PUBLIC_APP_URL or similar env var if available, otherwise fallback
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const shareableLink = `${baseUrl}/shared-workspace/${shareToken}`;

    console.log(`API sharing POST: Sharing enabled for workspace ${workspaceId} with token ${shareToken}`);

    // 5. Return success response
    return NextResponse.json({
      success: true,
      message: 'Workspace sharing enabled successfully.',
      shareableLink: shareableLink,
      shareToken: shareToken, // Also return token for potential direct use
    });

  } catch (error) {
    console.error(`API sharing POST: Unexpected error for workspace ${workspaceId}`, error);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 }); // Generic message
  }
}

/* -------------------------------------------------------------------------- */
/*  DELETE handler to disable sharing for a workspace                         */
/* -------------------------------------------------------------------------- */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> } // Context type from Next.js
): Promise<NextResponse> {
  void request; // Request object not used for DELETE
  
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
  const { workspaceId } = paramsValidation.data;

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

  try {
    // 1. Verify ownership (RLS implicitly handles this on update)
    // We perform an update directly, RLS will prevent it if the user doesn't own the workspace.
    const { error: updateError, count } = await supabase
      .from('workspaces')
      .update({
        share_token: null,
        is_shared_publicly: false,
        public_share_mode: null,
      })
      .eq('id', workspaceId)
      .eq('user_id', user.id); // Explicit user_id check for safety

    if (updateError) {
      console.error(`API sharing DELETE: Error disabling sharing for workspace ${workspaceId}`, updateError);
      return NextResponse.json(
        { error: 'Failed to disable sharing due to a server error.' }, // Generic message
        { status: 500 }
      );
    }

    if (count === 0) {
      // This means either the workspace didn't exist or the user didn't own it (RLS check failed implicitly)
      return NextResponse.json(
        { error: 'Workspace not found or you do not have permission to modify its sharing settings.' },
        { status: 404 }
      );
    }

    console.log(`API sharing DELETE: Sharing disabled for workspace ${workspaceId}`);

    // 2. Return success response (No Content)
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error(`API sharing DELETE: Unexpected error for workspace ${workspaceId}`, error);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 }); // Generic message
  }
}
