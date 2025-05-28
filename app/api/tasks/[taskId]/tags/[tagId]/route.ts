// app/api/tasks/[taskId]/tags/[tagId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const paramsSchema = z.object({
  taskId: z.string().uuid("Invalid Task ID format in URL."),
  tagId: z.string().uuid("Invalid Tag ID format in URL."),
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

interface TaskTagParams {
  taskId: string;
  tagId: string;
}

// DELETE handler to remove a tag from a task
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<TaskTagParams> } // Explicitly type context.params as a Promise
): Promise<NextResponse> {
  void request; // Request object not used for DELETE
  
  // Await the params object to resolve the Promise
  const resolvedParams = await context.params;

  // Log the received context and params
  console.log('API /api/tasks/[taskId]/tags/[tagId] DELETE - Received context:', JSON.stringify(context, null, 2));
  console.log('API /api/tasks/[taskId]/tags/[tagId] DELETE - Resolved params:', JSON.stringify(resolvedParams, null, 2));

  const paramsValidation = paramsSchema.safeParse(resolvedParams);

  if (!paramsValidation.success) {
    console.error('API /api/tasks/[taskId]/tags/[tagId] DELETE - Zod params validation failed. Errors:', JSON.stringify(paramsValidation.error.flatten().fieldErrors, null, 2));
    console.error('API /api/tasks/[taskId]/tags/[tagId] DELETE - Failing params:', JSON.stringify(resolvedParams, null, 2));
    return NextResponse.json(
      { error: 'Invalid URL parameters.' }, // Generic message, removed errors
      { status: 400 }
    );
  }
  const { taskId, tagId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  // RLS policies on 'task_tags' will check if the user owns the task and has access to the tag.
  const { error: deleteError, count } = await supabase
    .from('task_tags')
    .delete()
    .eq('task_id', taskId)
    .eq('tag_id', tagId);

  if (deleteError) {
    console.error(`API tasks/[${taskId}]/tags/[${tagId}]/DELETE: Error removing tag:`, deleteError);
    return NextResponse.json({ error: 'Failed to remove tag due to a server error.' }, { status: 500 }); // Generic message
  }

  if (count === 0) {
    // This means either the task-tag assignment didn't exist or the user didn't have permission.
    return NextResponse.json(
      { error: 'Tag assignment not found or you do not have permission to remove it.' },
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 }); // 204 No Content
}
