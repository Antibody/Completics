// app/api/tasks/[taskId]/labels/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const assignTagSchema = z.object({
  tag_id: z.string().uuid("Invalid Tag ID format."),
});

const paramsSchema = z.object({
  taskId: z.string().uuid("Invalid Task ID format in URL."),
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

interface TaskParams {
  taskId: string;
}

 // POST handler to assign a tag to a task
export async function POST(
  request: NextRequest,
  context: { params: Promise<TaskParams> } // Explicitly type context.params as a Promise
): Promise<NextResponse> {
  // Await the params object to resolve the Promise
  const resolvedParams = await context.params;

  // Log the received context and params
  console.log('API /api/tasks/[taskId]/tags POST - Received context:', JSON.stringify(context, null, 2));
  console.log('API /api/tasks/[taskId]/tags POST - Resolved params:', JSON.stringify(resolvedParams, null, 2));

  const paramsValidation = paramsSchema.safeParse(resolvedParams);

  if (!paramsValidation.success) {
    console.error('API /api/tasks/[taskId]/tags POST - Zod params validation failed. Errors:', JSON.stringify(paramsValidation.error.flatten().fieldErrors, null, 2));
    console.error('API /api/tasks/[taskId]/tags POST - Failing params:', JSON.stringify(resolvedParams, null, 2));
    return NextResponse.json(
      { error: 'Invalid URL parameters.' }, // Generic message, removed errors
      { status: 400 }
    );
  }
  const { taskId } = paramsValidation.data;

  const supabase = createSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (jsonError) {
    console.error(`API tasks/[${taskId}]/tags/POST: Error parsing JSON body:`, jsonError);
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const validationResult = assignTagSchema.safeParse(rawBody);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid request data.' }, // Generic message, removed errors
      { status: 400 }
    );
  }

  const { tag_id } = validationResult.data;

  // RLS policies on 'task_tags' will check if the user owns both the task and the tag.
  const { data, error: insertError } = await supabase
    .from('task_tags')
    .insert({
      task_id: taskId,
      tag_id: tag_id,
    })
    .select()
    .single();

  if (insertError) {
    console.error(`API tasks/[${taskId}]/tags/POST: Error assigning tag:`, insertError);
    if (insertError.code === '23503') { // Foreign key violation
        return NextResponse.json({ error: "Failed to assign tag: Task or Tag not found, or you don't have permission." }, { status: 404 });
    }
    if (insertError.code === '23505') { // Unique constraint violation (tag already assigned)
        return NextResponse.json({ error: "This tag is already assigned to the task." }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to assign tag due to a server error.' }, { status: 500 }); // Generic message
  }

  return NextResponse.json(data, { status: 201 }); // 201 Created
}
