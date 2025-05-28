// app/api/tasks/[taskId]/labels/[labelId]/route.ts
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
  _request: NextRequest, // Marked as unused
  context: { params: Promise<TaskTagParams> } // Explicitly type context.params as a Promise
): Promise<NextResponse> {
  // Await the params object to resolve the Promise
  const resolvedParams = await context.params;

  const paramsValidation = paramsSchema.safeParse(resolvedParams);

  if (!paramsValidation.success) {
    return NextResponse.json(
      { error: 'Invalid URL parameters.' }, // Generic message, removed errors
      { status: 400 }
    );
  }
  const { taskId, tagId } = paramsValidation.data; // Renamed from labelId

  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  // RLS policy "Users can delete task_tags for their own tasks" will ensure user owns the task.
  // The tag itself is not checked for ownership here, as the task owner should be able to remove any tag from their task.
  const { error, count } = await supabase
    .from('task_tags')
    .delete({ count: 'exact' })
    .eq('task_id', taskId)
    .eq('tag_id', tagId); // Changed from labelId

  if (error) {
    console.error(`API tasks/[${taskId}]/tags/[${tagId}]/DELETE: Error removing tag:`, error); // Updated log
    return NextResponse.json({ error: 'Failed to remove tag due to a server error.' }, { status: 500 }); // Generic message
  }

  if (count === 0) {
    // This could mean the tag wasn't assigned, or RLS prevented access (e.g., user doesn't own the task).
    return NextResponse.json({ error: 'Tag assignment not found or access denied.' }, { status: 404 }); // Updated message
  }

  return new NextResponse(null, { status: 204 }); // Successfully removed, no content
}
