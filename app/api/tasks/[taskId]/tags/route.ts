// app/api/tasks/[taskId]/tags/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  const { tag_id } = await request.json();

  if (!taskId || !tag_id) {
    return NextResponse.json(
      { error: 'Task ID and Tag ID are required.' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  try {
    // Check if the task exists and belongs to the user's accessible workspaces
    // RLS policies on `tasks` table should handle this automatically for the authenticated user.
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      // If taskError exists AND it's the PGRST116 (no rows) error, or if task is null
      if (taskError?.code === 'PGRST116' || !task) {
         console.error('API tasks/[taskId]/tags POST: Task not found or unauthorized (PGRST116 or no task):', taskError);
         return NextResponse.json(
           { error: 'Task not found or unauthorized.' },
           { status: 404 }
         );
      }
      // Handle other potential errors from the select query
      console.error('API tasks/[taskId]/tags POST: Error fetching task:', taskError);
       return NextResponse.json(
         { error: 'Failed to verify task.' },
         { status: 500 }
       );
    }

    // Check if the tag exists and is accessible by the user (owned, global, or shared)
    // RLS policies on `tags` table should handle this automatically.
    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('id')
      .eq('id', tag_id)
      .single();

    if (tagError || !tag) {
       if (tagError?.code === 'PGRST116' || !tag) {
         console.error('API tasks/[taskId]/tags POST: Tag not found or unauthorized (PGRST116 or no tag):', tagError);
         return NextResponse.json(
           { error: 'Tag not found or unauthorized.' },
           { status: 404 }
         );
       }
       console.error('API tasks/[taskId]/tags POST: Error fetching tag:', tagError);
       return NextResponse.json(
         { error: 'Failed to verify tag.' },
         { status: 500 }
       );
    }

    // Insert into task_tags junction table
    const { data, error } = await supabase
      .from('task_tags')
      .insert({ task_id: taskId, tag_id: tag_id })
      .select();

    if (error) {
      console.error('API tasks/[taskId]/tags POST: Error assigning tag:', error);
      // Handle unique constraint violation (tag already assigned)
      if (error.code === '23505') { // 23505 is unique_violation
        return NextResponse.json(
          { error: 'Tag already assigned to this task.' },
          { status: 409 } // Conflict
        );
      }
      return NextResponse.json(
        { error: 'Failed to assign tag.' },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0], { status: 201 });
  } catch (error) {
    console.error('API tasks/[taskId]/tags POST: Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
